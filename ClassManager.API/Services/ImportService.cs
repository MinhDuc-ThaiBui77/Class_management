using ClosedXML.Excel;
using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class ImportService
    {
        private readonly AppDbContext _db;
        public ImportService(AppDbContext db) => _db = db;

        // ── Tạo file Excel mẫu ────────────────────────────────────────
        public byte[] GenerateTemplate()
        {
            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Học sinh");

            // Header
            var headers = new[] { "Họ tên *", "Địa chỉ", "SĐT phụ huynh" };
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
            var studentIds = new List<int>(); // Tất cả HS (mới tạo + đã tồn tại)

            // Load existing students để dedup + tìm ID
            var existingStudents = await _db.Students
                .Where(s => s.IsActive)
                .Select(s => new { s.Id, Key = s.FullName.ToLower() + "|" + s.ParentPhone })
                .ToDictionaryAsync(s => s.Key, s => s.Id);

            foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
            {
                if (string.IsNullOrWhiteSpace(row.FullName))
                {
                    errors.Add(new ImportRowError(idx, "Họ tên không được để trống."));
                    continue;
                }

                // Normalize SĐT
                var rawPhone = row.ParentPhone?.Trim() ?? "";
                var phoneDigits = new string(rawPhone.Where(char.IsDigit).ToArray());
                if (phoneDigits.Length == 9 && phoneDigits[0] != '0')
                    phoneDigits = "0" + phoneDigits;
                var normalizedPhone = phoneDigits.Length == 10 && phoneDigits[0] == '0' ? phoneDigits : rawPhone;

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
                    EnrolledDate = DateTime.UtcNow,
                };

                _db.Students.Add(student);
                await _db.SaveChangesAsync();
                studentIds.Add(student.Id);
                existingStudents[key] = student.Id;
                created++;
            }

            return (new ImportResult(created, skipped, errors), studentIds);
        }

        // ── Import + enroll vào lớp ───────────────────────────────────
        public async Task<ImportResult> ImportAndEnrollAsync(int classId, Stream fileStream)
        {
            using var transaction = await _db.Database.BeginTransactionAsync();
            var cls = await _db.Classes.FindAsync(classId);
            if (cls == null) throw new InvalidOperationException("Lớp học không tồn tại.");

            var (result, studentIds) = await ImportStudentsAsync(fileStream);

            // Enroll TẤT CẢ HS (mới + đã tồn tại) vào lớp nếu chưa enroll
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

        // ── Parse Excel rows ──────────────────────────────────────────
        private static List<(string? FullName, string? Address, string? ParentPhone)>
            ParseRows(Stream stream)
        {
            var result = new List<(string?, string?, string?)>();
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheet(1);
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

            for (int r = 2; r <= lastRow; r++)
            {
                var fullName    = ws.Cell(r, 1).GetString().Trim();
                var address     = ws.Cell(r, 2).GetString().Trim();
                var parentPhone = ws.Cell(r, 3).GetString().Trim();

                if (string.IsNullOrEmpty(fullName) && string.IsNullOrEmpty(address))
                    continue; // bỏ qua hàng trống

                result.Add((
                    string.IsNullOrEmpty(fullName) ? null : fullName,
                    string.IsNullOrEmpty(address) ? null : address,
                    string.IsNullOrEmpty(parentPhone) ? null : parentPhone
                ));
            }
            return result;
        }
    }
}
