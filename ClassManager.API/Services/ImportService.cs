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
            var headers = new[] { "Họ tên *", "Số điện thoại", "SĐT phụ huynh", "Ngày sinh (yyyy-mm-dd)", "Ghi chú" };
            for (int i = 0; i < headers.Length; i++)
            {
                ws.Cell(1, i + 1).Value = headers[i];
                ws.Cell(1, i + 1).Style.Font.Bold = true;
                ws.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            }

            // Dữ liệu mẫu
            ws.Cell(2, 1).Value = "Nguyễn Văn A";
            ws.Cell(2, 2).Value = "0912345678";
            ws.Cell(2, 3).Value = "0987654321";
            ws.Cell(2, 4).Value = "2010-05-20";
            ws.Cell(2, 5).Value = "Học sinh giỏi";

            ws.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }

        // ── Import học sinh (tạo mới nếu chưa có) ────────────────────
        public async Task<(ImportResult Result, List<int> CreatedIds)> ImportStudentsAsync(Stream fileStream)
        {
            var rows = ParseRows(fileStream);
            int created = 0, skipped = 0;
            var errors  = new List<ImportRowError>();
            var createdIds = new List<int>();

            // Load phone numbers đã có sẵn để check trùng
            var existingPhones = await _db.Students
                .Where(s => s.IsActive && s.Phone != "")
                .Select(s => s.Phone)
                .ToHashSetAsync();

            foreach (var (row, idx) in rows.Select((r, i) => (r, i + 2)))
            {
                if (string.IsNullOrWhiteSpace(row.FullName))
                {
                    errors.Add(new ImportRowError(idx, "Họ tên không được để trống."));
                    continue;
                }

                // Skip nếu SĐT đã tồn tại
                if (!string.IsNullOrWhiteSpace(row.Phone) && existingPhones.Contains(row.Phone.Trim()))
                {
                    skipped++;
                    continue;
                }

                var student = new Student
                {
                    FullName    = row.FullName.Trim(),
                    Phone       = row.Phone?.Trim() ?? "",
                    ParentPhone = row.ParentPhone?.Trim() ?? "",
                    DateOfBirth = row.DateOfBirth.HasValue
                        ? DateTime.SpecifyKind(row.DateOfBirth.Value, DateTimeKind.Utc)
                        : null,
                    EnrolledDate = DateTime.UtcNow,
                    Notes        = row.Notes?.Trim() ?? "",
                };

                _db.Students.Add(student);
                await _db.SaveChangesAsync();
                createdIds.Add(student.Id);
                if (!string.IsNullOrWhiteSpace(student.Phone))
                    existingPhones.Add(student.Phone);
                created++;
            }

            return (new ImportResult(created, skipped, errors), createdIds);
        }

        // ── Import + enroll vào lớp ───────────────────────────────────
        public async Task<ImportResult> ImportAndEnrollAsync(int classId, Stream fileStream)
        {
            var cls = await _db.Classes.FindAsync(classId);
            if (cls == null) throw new InvalidOperationException("Lớp học không tồn tại.");

            var (result, createdIds) = await ImportStudentsAsync(fileStream);

            // Enroll tất cả HS vừa tạo + những HS đã có nhưng chưa trong lớp
            // (chỉ enroll các HS vừa import thành công)
            var alreadyEnrolled = await _db.StudentClasses
                .Where(sc => sc.ClassId == classId)
                .Select(sc => sc.StudentId)
                .ToHashSetAsync();

            foreach (var sid in createdIds.Where(id => !alreadyEnrolled.Contains(id)))
            {
                _db.StudentClasses.Add(new StudentClass
                {
                    ClassId      = classId,
                    StudentId    = sid,
                    EnrolledDate = DateTime.UtcNow,
                });
            }
            await _db.SaveChangesAsync();

            return result;
        }

        // ── Parse Excel rows ──────────────────────────────────────────
        private static List<(string? FullName, string? Phone, string? ParentPhone, DateTime? DateOfBirth, string? Notes)>
            ParseRows(Stream stream)
        {
            var result = new List<(string?, string?, string?, DateTime?, string?)>();
            using var wb = new XLWorkbook(stream);
            var ws = wb.Worksheet(1);
            var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

            for (int r = 2; r <= lastRow; r++)
            {
                var fullName    = ws.Cell(r, 1).GetString().Trim();
                var phone       = ws.Cell(r, 2).GetString().Trim();
                var parentPhone = ws.Cell(r, 3).GetString().Trim();
                var dobStr      = ws.Cell(r, 4).GetString().Trim();
                var notes       = ws.Cell(r, 5).GetString().Trim();

                DateTime? dob = null;
                if (!string.IsNullOrEmpty(dobStr) && DateTime.TryParse(dobStr, out var parsed))
                    dob = parsed;

                if (string.IsNullOrEmpty(fullName) && string.IsNullOrEmpty(phone))
                    continue; // bỏ qua hàng trống

                result.Add((
                    string.IsNullOrEmpty(fullName) ? null : fullName,
                    string.IsNullOrEmpty(phone) ? null : phone,
                    string.IsNullOrEmpty(parentPhone) ? null : parentPhone,
                    dob,
                    string.IsNullOrEmpty(notes) ? null : notes
                ));
            }
            return result;
        }
    }
}
