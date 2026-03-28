using ClosedXML.Excel;
using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ClassManager.API.Services
{
    public class ImportService
    {
        private readonly AppDbContext _db;
        public ImportService(AppDbContext db) => _db = db;

        // ── Danh sách cột nhận diện + alias ─────────────────────────────
        private static readonly Dictionary<string, string[]> ColumnAliases = new(StringComparer.OrdinalIgnoreCase)
        {
            ["FullName"]     = ["Họ tên", "Họ tên *", "Họ và tên", "Tên học sinh", "Tên HS", "FullName"],
            ["Address"]      = ["Địa chỉ", "Địa chỉ", "Address"],
            ["ParentPhone"]  = ["SĐT phụ huynh", "SĐT PH", "SĐT", "Số điện thoại", "Phone", "SDT"],
            ["DateOfBirth"]  = ["Ngày sinh", "Sinh nhày", "Date of Birth", "DOB"],
            ["EnrolledDate"] = ["Ngày nhập học", "Ngày đăng ký", "Ngày đăng kí", "Enrolled Date"],
            ["Notes"]        = ["Ghi chú", "Notes", "Ghi chu"],
        };

        // ── Tạo file Excel mẫu ────────────────────────────────────────
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

            // Dữ liệu mẫu
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

        // ── Import học sinh (tạo mới nếu chưa có) ────────────────────
        public async Task<(ImportResult Result, List<int> StudentIds)> ImportStudentsAsync(Stream fileStream)
        {
            var rows = ParseRows(fileStream);
            int created = 0, skipped = 0;
            var errors  = new List<ImportRowError>();
            var warnings = new List<ImportRowError>();
            var studentIds = new List<int>();

            var existingStudents = await _db.Students
                .Where(s => s.IsActive)
                .Select(s => new { s.Id, Key = s.FullName.ToLower() + "|" + s.ParentPhone })
                .ToDictionaryAsync(s => s.Key, s => s.Id);

            foreach (var (row, idx) in rows.Select((r, i) => (r, i)))
            {
                if (string.IsNullOrWhiteSpace(row.FullName))
                {
                    errors.Add(new ImportRowError(row.SourceRow, "Họ tên không được để trống."));
                    continue;
                }

                // Validate & clean phone
                var phoneResult = CleanPhone(row.ParentPhone);
                var notesParts = new List<string>();
                if (!string.IsNullOrEmpty(row.Notes))
                    notesParts.Add(row.Notes);

                if (phoneResult.InvalidValue != null)
                {
                    notesParts.Add($"SĐT gốc: {phoneResult.InvalidValue}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"SĐT không hợp lệ \"{phoneResult.InvalidValue}\" → chuyển sang ghi chú"));
                }

                // Validate & clean dates
                var dob = CleanDate(row.DateOfBirth);
                if (dob.InvalidValue != null)
                {
                    notesParts.Add($"Ngày sinh gốc: {dob.InvalidValue}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"Ngày sinh không hợp lệ \"{dob.InvalidValue}\" → chuyển sang ghi chú"));
                }

                var enrolledDate = CleanDate(row.EnrolledDate);
                if (enrolledDate.InvalidValue != null)
                {
                    notesParts.Add($"Ngày nhập học gốc: {enrolledDate.InvalidValue}");
                    warnings.Add(new ImportRowError(row.SourceRow, $"Ngày nhập học không hợp lệ \"{enrolledDate.InvalidValue}\" → chuyển sang ghi chú"));
                }

                var normalizedPhone = phoneResult.CleanValue ?? "";
                var key = row.FullName.Trim().ToLower() + "|" + normalizedPhone;

                if (existingStudents.TryGetValue(key, out var existingId))
                {
                    studentIds.Add(existingId);
                    skipped++;
                    continue;
                }

                var student = new Student
                {
                    FullName     = row.FullName.Trim(),
                    Address      = row.Address?.Trim() ?? "",
                    ParentPhone  = normalizedPhone,
                    DateOfBirth  = dob.CleanDate,
                    EnrolledDate = enrolledDate.CleanDate ?? DateTime.UtcNow,
                    Notes        = string.Join(" | ", notesParts),
                };

                _db.Students.Add(student);
                await _db.SaveChangesAsync();
                studentIds.Add(student.Id);
                existingStudents[key] = student.Id;
                created++;
            }

            return (new ImportResult(created, skipped, errors, warnings), studentIds);
        }

        // ── Import + enroll vào lớp ───────────────────────────────────
        public async Task<ImportResult> ImportAndEnrollAsync(int classId, Stream fileStream)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            var cls = await _db.Classes.FindAsync(classId);
            if (cls == null) throw new InvalidOperationException("Lớp học không tồn tại.");

            var (result, studentIds) = await ImportStudentsAsync(fileStream);

            var alreadyEnrolled = await _db.StudentClasses
                .Where(sc => sc.ClassId == classId)
                .Select(sc => sc.StudentId)
                .ToHashSetAsync();

            var enrolled = 0;
            var toEnroll = studentIds.Distinct().Where(id => !alreadyEnrolled.Contains(id));
            foreach (var sid in toEnroll)
            {
                _db.StudentClasses.Add(new StudentClass
                {
                    ClassId      = classId,
                    StudentId    = sid,
                    EnrolledDate = DateTime.UtcNow,
                });
                enrolled++;
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

            // Bước 1: Quét tìm cell "Họ tên" → xác định headerRow + headerCol
            int headerRow = -1;
            int headerCol = -1;
            var fullNameAliases = ColumnAliases["FullName"];

            for (int r = 1; r <= Math.Min(lastRow, 20); r++) // chỉ quét 20 dòng đầu
            {
                for (int c = 1; c <= lastCol; c++)
                {
                    var cellValue = ws.Cell(r, c).GetString().Trim();
                    if (fullNameAliases.Any(alias => cellValue.Equals(alias, StringComparison.OrdinalIgnoreCase)))
                    {
                        headerRow = r;
                        headerCol = c;
                        break;
                    }
                }
                if (headerRow > 0) break;
            }

            // Không tìm thấy header → fallback: row 1 là header, col 1 bắt đầu (tương thích cũ)
            if (headerRow < 0)
            {
                headerRow = 1;
                headerCol = 1;
            }

            // Bước 2: Đọc header row → map tên cột → field
            var columnMapping = new Dictionary<string, int>(); // field → column number
            for (int c = headerCol; c <= lastCol; c++)
            {
                var headerValue = ws.Cell(headerRow, c).GetString().Trim();
                if (string.IsNullOrEmpty(headerValue)) continue;

                foreach (var (field, aliases) in ColumnAliases)
                {
                    if (columnMapping.ContainsKey(field)) continue; // đã map rồi
                    if (aliases.Any(alias => headerValue.Equals(alias, StringComparison.OrdinalIgnoreCase)))
                    {
                        columnMapping[field] = c;
                        break;
                    }
                }
            }

            // Bước 3: Đọc data rows — bỏ row nào cột FullName trống
            for (int r = headerRow + 1; r <= lastRow; r++)
            {
                var fullName = GetCellString(ws, r, columnMapping.GetValueOrDefault("FullName", -1));
                if (string.IsNullOrWhiteSpace(fullName)) continue;

                result.Add(new ParsedStudentRow
                {
                    SourceRow    = r,
                    FullName     = fullName,
                    Address      = GetCellString(ws, r, columnMapping.GetValueOrDefault("Address", -1)),
                    ParentPhone  = GetCellString(ws, r, columnMapping.GetValueOrDefault("ParentPhone", -1)),
                    DateOfBirth  = GetCellString(ws, r, columnMapping.GetValueOrDefault("DateOfBirth", -1)),
                    EnrolledDate = GetCellString(ws, r, columnMapping.GetValueOrDefault("EnrolledDate", -1)),
                    Notes        = GetCellString(ws, r, columnMapping.GetValueOrDefault("Notes", -1)),
                });
            }

            return result;
        }

        private static string? GetCellString(IXLWorksheet ws, int row, int col)
        {
            if (col < 0) return null;
            var val = ws.Cell(row, col).GetString().Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        // ── Phone cleaning ──────────────────────────────────────────────
        private static (string? CleanValue, string? InvalidValue) CleanPhone(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return (null, null);

            // Xóa dấu chấm, dấu cách, dấu gạch ngang
            var cleaned = Regex.Replace(raw.Trim(), @"[\s.\-()]", "");

            // Chỉ giữ ký tự số
            var digits = new string(cleaned.Where(char.IsDigit).ToArray());

            // Nếu sau khi clean không phải toàn số → invalid
            if (digits.Length != cleaned.Length || digits.Length < 9 || digits.Length > 11)
            {
                // Kiểm tra xem có chứa số nào không — nếu không có số nào thì chắc chắn không phải SĐT
                if (digits.Length == 0 || digits.Length < 9)
                    return (null, raw.Trim());
            }

            // 9 số → thêm 0
            if (digits.Length == 9 && digits[0] != '0')
                digits = "0" + digits;

            // Validate: 10 số, bắt đầu bằng 0
            if (digits.Length == 10 && digits[0] == '0')
                return (digits, null);

            return (null, raw.Trim());
        }

        // ── Date cleaning ───────────────────────────────────────────────
        private static readonly string[] DateFormats = [
            "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy",
            "dd/MM/yy", "d/M/yy", "yyyy-MM-dd", "MM/dd/yyyy",
        ];

        private static (DateTime? CleanDate, string? InvalidValue) CleanDate(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return (null, null);

            var trimmed = raw.Trim();

            if (DateTime.TryParseExact(trimmed, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                return (DateTime.SpecifyKind(dt, DateTimeKind.Utc), null);

            if (DateTime.TryParse(trimmed, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out dt))
                return (DateTime.SpecifyKind(dt, DateTimeKind.Utc), null);

            return (null, trimmed);
        }

        // ── Parsed row model ────────────────────────────────────────────
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
