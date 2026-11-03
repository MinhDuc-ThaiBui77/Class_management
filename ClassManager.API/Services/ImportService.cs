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
        // Duyệt hết file trước rồi mới ghi: nếu còn dòng nghi trùng chưa có quyết định
        // thì không ghi gì, trả suspects để user quyết rồi gửi lại cả file.
        public async Task<(ImportResult Result, List<int> StudentIds)> ImportStudentsAsync(
            Stream fileStream, Dictionary<int, string>? dupDecisions = null)
        {
            var rows = ParseRows(fileStream);
            int skipped = 0;
            var errors   = new List<ImportRowError>();
            var warnings = new List<ImportRowError>();
            var suspects = new List<DuplicateSuspect>();
            var planned  = new List<Student>();
            var rowTargets = new List<MatchTarget>(); // HS ứng với mỗi dòng (tạo mới hoặc bỏ qua) → dùng để enroll

            // Load existing students for dedup
            var existingStudents = await _db.Students
                .Where(s => s.IsActive)
                .Select(s => new { s.Id, s.FullName, s.ParentPhone, s.DateOfBirth })
                .ToListAsync();

            // Build lookup structures — gồm cả HS có sẵn và HS sắp tạo từ các dòng trước trong file
            var exactKeys     = new Dictionary<string, MatchTarget>(); // name+dob+phone
            var namePhoneKeys = new Dictionary<string, MatchTarget>(); // name+phone
            var nameDobKeys   = new Dictionary<string, MatchTarget>(); // name+dob
            var nameOnlyKeys  = new Dictionary<string, MatchTarget>(); // name

            void Register(MatchTarget t, string normName, string phone, string dobKey)
            {
                if (!string.IsNullOrEmpty(phone) && !string.IsNullOrEmpty(dobKey))
                    exactKeys.TryAdd($"{normName}|{dobKey}|{phone}", t);
                if (!string.IsNullOrEmpty(phone))
                    namePhoneKeys.TryAdd($"{normName}|{phone}", t);
                if (!string.IsNullOrEmpty(dobKey))
                    nameDobKeys.TryAdd($"{normName}|{dobKey}", t);
                nameOnlyKeys.TryAdd(normName, t);
            }

            foreach (var s in existingStudents)
            {
                var target = new MatchTarget { ExistingId = s.Id, Name = s.FullName, Phone = s.ParentPhone ?? "", Dob = s.DateOfBirth };
                Register(target, NameHelper.NormalizeForCompare(s.FullName), s.ParentPhone ?? "", s.DateOfBirth?.ToString("yyyyMMdd") ?? "");
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
                MatchTarget? match = null;
                string? matchTier = null;

                // Tier 1: Exact (name + dob + phone → auto-skip)
                if (!string.IsNullOrEmpty(normalizedPhone) && !string.IsNullOrEmpty(dobKey))
                {
                    var key = $"{compareName}|{dobKey}|{normalizedPhone}";
                    if (exactKeys.TryGetValue(key, out var t))
                    { match = t; matchTier = "exact"; }
                }

                // Tier 2: Partial match → suspect (hỏi user)
                if (match == null)
                {
                    // name + phone
                    if (!string.IsNullOrEmpty(normalizedPhone))
                    {
                        var key = $"{compareName}|{normalizedPhone}";
                        if (namePhoneKeys.TryGetValue(key, out var t))
                        { match = t; matchTier = "name_phone"; }
                    }
                    // name + dob
                    if (match == null && !string.IsNullOrEmpty(dobKey))
                    {
                        var key = $"{compareName}|{dobKey}";
                        if (nameDobKeys.TryGetValue(key, out var t))
                        { match = t; matchTier = "name_dob"; }
                    }
                    // name only (cả 2 thiếu phone + dob)
                    if (match == null && string.IsNullOrEmpty(normalizedPhone) && string.IsNullOrEmpty(dobKey))
                    {
                        if (nameOnlyKeys.TryGetValue(compareName, out var t))
                        { match = t; matchTier = "name_only"; }
                    }
                }

                // Xử lý kết quả dedup
                if (match != null && matchTier == "exact")
                {
                    // Tier 1: chắc chắn trùng → auto-skip
                    rowTargets.Add(match);
                    skipped++;
                    continue;
                }

                if (match != null && matchTier != null)
                {
                    // Tier 2: nghi ngờ → kiểm tra dupDecisions
                    var decision = dupDecisions?.GetValueOrDefault(row.SourceRow, "ask") ?? "ask";

                    if (decision == "skip")
                    {
                        rowTargets.Add(match);
                        skipped++;
                        continue;
                    }
                    else if (decision != "create")
                    {
                        // "ask" → thêm vào suspects, không tạo
                        suspects.Add(new DuplicateSuspect(
                            row.SourceRow,
                            normalizedName,
                            normalizedPhone,
                            dob.Date?.ToString("dd/MM/yyyy"),
                            match.ExistingId ?? 0,
                            match.Name,
                            match.Phone,
                            match.Dob?.ToString("dd/MM/yyyy"),
                            matchTier,
                            match.PlannedRow
                        ));
                        continue;
                    }
                    // "create" → fall through to create new
                }

                // Tier 3: không khớp → lên kế hoạch tạo mới
                var student = new Student
                {
                    FullName     = normalizedName,
                    Address      = cleanAddress,
                    ParentPhone  = normalizedPhone,
                    DateOfBirth  = dob.Date,
                    EnrolledDate = enrolled.Date ?? DateTime.UtcNow,
                    Notes        = string.Join(" | ", notesParts),
                };
                planned.Add(student);

                // Add to lookup for subsequent rows in same batch
                var newTarget = new MatchTarget { Planned = student, PlannedRow = row.SourceRow, Name = normalizedName, Phone = normalizedPhone, Dob = dob.Date };
                rowTargets.Add(newTarget);
                Register(newTarget, compareName, normalizedPhone, dobKey);
            }

            // Còn dòng nghi trùng chưa quyết → không ghi gì
            if (suspects.Count > 0)
                return (new ImportResult(0, 0, errors, warnings, suspects), new List<int>());

            // Ghi tất cả trong 1 lần SaveChanges → hoặc đủ hết, hoặc không có gì
            _db.Students.AddRange(planned);
            await _db.SaveChangesAsync();

            var studentIds = rowTargets.Select(t => t.ExistingId ?? t.Planned!.Id).ToList();
            return (new ImportResult(planned.Count, skipped, errors, warnings, suspects), studentIds);
        }

        // HS mà một dòng import khớp tới: có sẵn trong DB, hoặc sẽ được tạo từ dòng trước trong file
        private class MatchTarget
        {
            public int? ExistingId { get; init; }
            public Student? Planned { get; init; }
            public int? PlannedRow { get; init; }
            public string Name { get; init; } = "";
            public string Phone { get; init; } = "";
            public DateTime? Dob { get; init; }
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
