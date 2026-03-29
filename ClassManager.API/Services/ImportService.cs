using ClosedXML.Excel;
using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ClassManager.API.Services
{
    public class ImportService
    {
        private readonly AppDbContext _db;
        public ImportService(AppDbContext db) => _db = db;

        // ── Column aliases (khớp với ExportService canonical format) ────
        private static readonly Dictionary<string, string[]> ColumnAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            ["FullName"]     = ["Họ tên", "Họ tên *", "Họ và tên", "Tên học sinh", "Tên HS", "FullName"],
            ["Address"]      = ["Địa chỉ", "Address"],
            ["ParentPhone"]  = ["SĐT phụ huynh", "SĐT PH", "SĐT", "Số điện thoại", "Phone", "SDT"],
            ["DateOfBirth"]  = ["Ngày sinh", "Date of Birth", "DOB"],
            ["EnrolledDate"] = ["Ngày nhập học", "Ngày đăng ký", "Ngày đăng kí", "Enrolled Date"],
            ["Notes"]        = ["Ghi chú", "Notes", "Ghi chu"],
        };

        // ── Tạo file Excel mẫu (khớp canonical format) ─────────────────
        public byte[] GenerateTemplate()
        {
            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Học sinh");

            var headers = new[] { "Họ tên *", "Địa chỉ", "SĐT phụ huynh", "Ngày sinh", "Ngày nhập học", "Ghi chú" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
                ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            }

            ws.Cell(2, 1).Value = "Nguyễn Văn A";
            ws.Cell(2, 2).Value = "123 Lê Lợi, Q1, TP.HCM";
            ws.Cell(2, 3).Value = "0987654321";
            ws.Cell(2, 4).Value = "15/06/2010";
            ws.Cell(2, 5).Value = "01/09/2024";
            ws.Cell(2, 6).Value = "";

            ws.Columns().AdjustToContents();
            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }

        // ── Import học sinh: 3-tier dedup ───────────────────────────────
        public async Task<(ImportResult Result, List<int> StudentIds)> ImportStudentsAsync(
            Stream fileStream, Dictionary<int, string>? dupDecisions = null)
        {
            var rows = ParseRows(fileStream);
            int created = 0, skipped = 0;
            var errors   = new List<ImportRowError>();
            var warnings = new List<ImportRowError>();
            var suspects = new List<DuplicateSuspect>();
            var studentIds = new List<int>();

            // Load existing students for dedup
            var existingStudents = await _db.Students
                .Where(s => s.IsActive)
                .Select(s => new { s.Id, s.FullName, s.ParentPhone, s.DateOfBirth })
                .ToListAsync();

            // Build lookup structures
            var exactKeys = new Dictionary<string, int>();   // name+dob+phone → id
            var namePhoneKeys = new Dictionary<string, int>(); // name+phone → id
            var nameDobKeys = new Dictionary<string, int>();   // name+dob → id
            var nameOnlyKeys = new Dictionary<string, List<int>>(); // name → [ids]

            foreach (var s in existingStudents)
            {
                var normName = NameHelper.NormalizeForCompare(s.FullName);
                var normPhone = s.ParentPhone ?? "";
                var dobKey = s.DateOfBirth?.ToString("yyyyMMdd") ?? "";

                // Exact: name + dob + phone (all 3)
                if (!string.IsNullOrEmpty(normPhone) && !string.IsNullOrEmpty(dobKey))
                    exactKeys.TryAdd($"{normName}|{dobKey}|{normPhone}", s.Id);

                // name + phone
                if (!string.IsNullOrEmpty(normPhone))
                    namePhoneKeys.TryAdd($"{normName}|{normPhone}", s.Id);

                // name + dob
                if (!string.IsNullOrEmpty(dobKey))
                    nameDobKeys.TryAdd($"{normName}|{dobKey}", s.Id);

                // name only
                if (!nameOnlyKeys.ContainsKey(normName))
                    nameOnlyKeys[normName] = [];
                nameOnlyKeys[normName].Add(s.Id);
            }

            foreach (var row in rows)
            {
                if (string.IsNullOrWhiteSpace(row.FullName))
                {
                    errors.Add(new ImportRowError(row.SourceRow, "Họ tên không được để trống."));
                    continue;
                }

                // Chuẩn hóa tên
                var normalizedName = NameHelper.NormalizeVietnamese(row.FullName);
                var compareName = NameHelper.NormalizeForCompare(normalizedName);

                // Validate & clean phone → invalid thì ném vào ghi chú
                var phoneResult = PhoneHelper.TryNormalize(row.ParentPhone);
                var notesParts = new List<string>();
                if (!string.IsNullOrEmpty(row.Notes)) notesParts.Add(row.Notes);

                if (phoneResult.Invalid != null)
                {
                    notesParts.Add($"SĐT gốc: {phoneResult.Invalid}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"SĐT \"{phoneResult.Invalid}\" không hợp lệ → ghi chú"));
                }

                // Validate & clean dates → invalid thì ném vào ghi chú
                var dob = CleanDate(row.DateOfBirth);
                if (dob.Invalid != null)
                {
                    notesParts.Add($"Ngày sinh gốc: {dob.Invalid}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"Ngày sinh \"{dob.Invalid}\" không hợp lệ → ghi chú"));
                }

                var enrolled = CleanDate(row.EnrolledDate);
                if (enrolled.Invalid != null)
                {
                    notesParts.Add($"Ngày nhập học gốc: {enrolled.Invalid}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"Ngày nhập học \"{enrolled.Invalid}\" không hợp lệ → ghi chú"));
                }

                // Validate address — nếu toàn số hoặc chứa ký tự lạ thì cảnh báo nhẹ
                var cleanAddress = row.Address?.Trim() ?? "";

                var normalizedPhone = phoneResult.Clean ?? "";
                var dobKey = dob.Date?.ToString("yyyyMMdd") ?? "";

                // ── 3-tier dedup ──────────────────────────────────────
                int? matchedId = null;
                string? matchTier = null;

                // Tier 1: Exact (name + dob + phone → auto-skip)
                if (!string.IsNullOrEmpty(normalizedPhone) && !string.IsNullOrEmpty(dobKey))
                {
                    var key = $"{compareName}|{dobKey}|{normalizedPhone}";
                    if (exactKeys.TryGetValue(key, out var eid))
                    { matchedId = eid; matchTier = "exact"; }
                }

                // Tier 2: Partial match → suspect (hỏi user)
                if (matchedId == null)
                {
                    // name + phone
                    if (!string.IsNullOrEmpty(normalizedPhone))
                    {
                        var key = $"{compareName}|{normalizedPhone}";
                        if (namePhoneKeys.TryGetValue(key, out var eid))
                        { matchedId = eid; matchTier = "name_phone"; }
                    }
                    // name + dob
                    if (matchedId == null && !string.IsNullOrEmpty(dobKey))
                    {
                        var key = $"{compareName}|{dobKey}";
                        if (nameDobKeys.TryGetValue(key, out var eid))
                        { matchedId = eid; matchTier = "name_dob"; }
                    }
                    // name only (cả 2 thiếu phone + dob)
                    if (matchedId == null && string.IsNullOrEmpty(normalizedPhone) && string.IsNullOrEmpty(dobKey))
                    {
                        if (nameOnlyKeys.TryGetValue(compareName, out var eids) && eids.Count > 0)
                        { matchedId = eids[0]; matchTier = "name_only"; }
                    }
                }

                // Xử lý kết quả dedup
                if (matchedId != null && matchTier == "exact")
                {
                    // Tier 1: chắc chắn trùng → auto-skip
                    studentIds.Add(matchedId.Value);
                    skipped++;
                    continue;
                }

                if (matchedId != null && matchTier != null)
                {
                    // Tier 2: nghi ngờ → kiểm tra dupDecisions
                    var existing = existingStudents.First(s => s.Id == matchedId.Value);
                    var decision = dupDecisions?.GetValueOrDefault(row.SourceRow, "ask") ?? "ask";

                    if (decision == "skip")
                    {
                        studentIds.Add(matchedId.Value);
                        skipped++;
                        continue;
                    }
                    else if (decision == "create")
                    {
                        // Fall through to create new
                    }
                    else
                    {
                        // "ask" → thêm vào suspects, không tạo
                        suspects.Add(new DuplicateSuspect(
                            row.SourceRow,
                            normalizedName,
                            normalizedPhone,
                            dob.Date?.ToString("dd/MM/yyyy"),
                            matchedId.Value,
                            existing.FullName,
                            existing.ParentPhone ?? "",
                            existing.DateOfBirth?.ToString("dd/MM/yyyy"),
                            matchTier
                        ));
                        continue;
                    }
                }

                // Tier 3: không khớp → tạo mới
                var student = new Student
                {
                    FullName     = normalizedName,
                    Address      = cleanAddress,
                    ParentPhone  = normalizedPhone,
                    DateOfBirth  = dob.Date,
                    EnrolledDate = enrolled.Date ?? DateTime.UtcNow,
                    Notes        = string.Join(" | ", notesParts),
                };

                _db.Students.Add(student);
                await _db.SaveChangesAsync();
                studentIds.Add(student.Id);

                // Add to lookup for subsequent rows in same batch
                var newExact = $"{compareName}|{dobKey}|{normalizedPhone}";
                exactKeys.TryAdd(newExact, student.Id);
                if (!string.IsNullOrEmpty(normalizedPhone))
                    namePhoneKeys.TryAdd($"{compareName}|{normalizedPhone}", student.Id);
                if (!string.IsNullOrEmpty(dobKey))
                    nameDobKeys.TryAdd($"{compareName}|{dobKey}", student.Id);
                if (!nameOnlyKeys.ContainsKey(compareName))
                    nameOnlyKeys[compareName] = [];
                nameOnlyKeys[compareName].Add(student.Id);

                created++;
            }

            return (new ImportResult(created, skipped, errors, warnings, suspects), studentIds);
        }

        // ── Import + enroll vào lớp ───────────────────────────────────
        public async Task<ImportResult> ImportAndEnrollAsync(int classId, Stream fileStream, Dictionary<int, string>? dupDecisions = null)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            var cls = await _db.Classes.FindAsync(classId);
            if (cls == null) throw new InvalidOperationException("Lớp học không tồn tại.");

            var (result, studentIds) = await ImportStudentsAsync(fileStream, dupDecisions);

            var alreadyEnrolled = await _db.StudentClasses
                .Where(sc => sc.ClassId == classId)
                .Select(sc => sc.StudentId)
                .ToHashSetAsync();

            foreach (var sid in studentIds.Distinct().Where(id => !alreadyEnrolled.Contains(id)))
            {
                _db.StudentClasses.Add(new StudentClass
                {
                    ClassId      = classId,
                    StudentId    = sid,
                    EnrolledDate = DateTime.UtcNow,
                });
            }
            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            return result;
        }

        // ── Auto-detect header & parse rows ─────────────────────────────
        private static List<ParsedStudentRow> ParseRows(Stream stream)
        {
            var result = new List<ParsedStudentRow>();
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheet(1);
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
            var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 1;

            // Bước 1: Quét tìm cell "Họ tên"
            int headerRow = -1;
            var fullNameAliases = ColumnAliases["FullName"];

            for (int r = 1; r <= Math.Min(lastRow, 20); r++)
            {
                for (int c = 1; c <= lastCol; c++)
                {
                    var val = ws.Cell(r, c).GetString().Trim();
                    if (fullNameAliases.Any(a => val.Equals(a, StringComparison.OrdinalIgnoreCase)))
                    {
                        headerRow = r;
                        break;
                    }
                }
                if (headerRow > 0) break;
            }

            if (headerRow < 0) { headerRow = 1; }

            // Bước 2: Map tên cột → field
            var columnMapping = new Dictionary<string, int>();
            for (int c = 1; c <= lastCol; c++)
            {
                var headerValue = ws.Cell(headerRow, c).GetString().Trim();
                if (string.IsNullOrEmpty(headerValue)) continue;

                foreach (var (field, aliases) in ColumnAliases)
                {
                    if (columnMapping.ContainsKey(field)) continue;
                    if (aliases.Any(a => headerValue.Equals(a, StringComparison.OrdinalIgnoreCase)))
                    {
                        columnMapping[field] = c;
                        break;
                    }
                }
            }

            // Bước 3: Đọc data — skip row nào cột FullName trống
            for (int r = headerRow + 1; r <= lastRow; r++)
            {
                var fullName = GetCell(ws, r, columnMapping.GetValueOrDefault("FullName", -1));
                if (string.IsNullOrWhiteSpace(fullName)) continue;

                result.Add(new ParsedStudentRow
                {
                    SourceRow    = r,
                    FullName     = fullName,
                    Address      = GetCell(ws, r, columnMapping.GetValueOrDefault("Address", -1)),
                    ParentPhone  = GetCell(ws, r, columnMapping.GetValueOrDefault("ParentPhone", -1)),
                    DateOfBirth  = GetCell(ws, r, columnMapping.GetValueOrDefault("DateOfBirth", -1)),
                    EnrolledDate = GetCell(ws, r, columnMapping.GetValueOrDefault("EnrolledDate", -1)),
                    Notes        = GetCell(ws, r, columnMapping.GetValueOrDefault("Notes", -1)),
                });
            }
            return result;
        }

        private static string? GetCell(IXLWorksheet ws, int row, int col)
        {
            if (col < 0) return null;
            var val = ws.Cell(row, col).GetString().Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        // ── Date cleaning ───────────────────────────────────────────────
        private static readonly string[] DateFormats = [
            "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy",
            "dd/MM/yy", "d/M/yy", "yyyy-MM-dd", "MM/dd/yyyy",
        ];

        private static (DateTime? Date, string? Invalid) CleanDate(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return (null, null);
            var trimmed = raw.Trim();

            if (DateTime.TryParseExact(trimmed, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                return (DateTime.SpecifyKind(dt, DateTimeKind.Utc), null);

            if (DateTime.TryParse(trimmed, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out dt))
                return (DateTime.SpecifyKind(dt, DateTimeKind.Utc), null);

            return (null, trimmed);
        }

        private class ParsedStudentRow
        {
            public int SourceRow { get; set; }
            public string? FullName { get; set; }
            public string? Address { get; set; }
            public string? ParentPhone { get; set; }
            public string? DateOfBirth { get; set; }
            public string? EnrolledDate { get; set; }
            public string? Notes { get; set; }
        }
    }
}
