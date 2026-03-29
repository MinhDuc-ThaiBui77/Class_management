using ClosedXML.Excel;
using ClassManager.API.Data;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class ExportService
    {
        private readonly AppDbContext _db;
        public ExportService(AppDbContext db) => _db = db;

        // ── Canonical student columns ────────────────────────────────
        // Editable (import + export): Họ tên, Địa chỉ, SĐT phụ huynh, Ngày sinh, Ngày nhập học, Ghi chú
        // Read-only (export only):    STT, Lớp đang học

        private static readonly string[] StudentEditableHeaders =
            ["Họ tên", "Địa chỉ", "SĐT phụ huynh", "Ngày sinh", "Ngày nhập học", "Ghi chú"];

        private static readonly string[] StudentReadOnlyHeaders =
            ["STT", "Lớp đang học"];

        private static void StyleHeader(IXLRow row)
        {
            row.Style.Font.Bold = true;
            row.Style.Fill.BackgroundColor = XLColor.FromHtml("#DE2228");
            row.Style.Font.FontColor = XLColor.White;
        }

        private static void StyleReadOnlyHeader(IXLCell cell)
        {
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#999999");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Font.Bold = true;
            cell.Style.Font.Italic = true;
        }

        // ── Xuất danh sách học sinh ────────────────────────────────
        public async Task<byte[]> ExportStudentsAsync(int? teacherId = null)
        {
            var query = _db.Students.Where(s => s.IsActive).AsQueryable();
            if (teacherId.HasValue)
            {
                var ids = await _db.StudentClasses
                    .Where(sc => sc.Class.TeacherId == teacherId.Value)
                    .Select(sc => sc.StudentId).Distinct().ToListAsync();
                query = query.Where(s => ids.Contains(s.Id));
            }

            var students = await query
                .OrderBy(s => s.FullName)
                .Select(s => new
                {
                    s.FullName, s.Address, s.ParentPhone, s.DateOfBirth, s.EnrolledDate, s.Notes,
                    Classes = string.Join(", ", s.StudentClasses.Select(sc => sc.Class.Name + " " + sc.Class.Subject))
                }).ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Danh sách học sinh");

            // Header: STT (read-only) + editable columns + Lớp đang học (read-only)
            ws.Cell(1, 1).Value = "STT";
            StyleReadOnlyHeader(ws.Cell(1, 1));
            for (int i = 0; i < StudentEditableHeaders.Length; i++)
                ws.Cell(1, i + 2).Value = StudentEditableHeaders[i];
            ws.Cell(1, StudentEditableHeaders.Length + 2).Value = "Lớp đang học";
            StyleReadOnlyHeader(ws.Cell(1, StudentEditableHeaders.Length + 2));
            StyleHeader(ws.Row(1));
            // Re-apply read-only style on top
            StyleReadOnlyHeader(ws.Cell(1, 1));
            StyleReadOnlyHeader(ws.Cell(1, StudentEditableHeaders.Length + 2));

            for (int i = 0; i < students.Count; i++)
            {
                var s = students[i];
                var r = i + 2;
                ws.Cell(r, 1).Value = i + 1;                                          // STT
                ws.Cell(r, 2).Value = s.FullName;                                      // Họ tên
                ws.Cell(r, 3).Value = s.Address;                                       // Địa chỉ
                ws.Cell(r, 4).Value = s.ParentPhone;                                   // SĐT phụ huynh
                ws.Cell(r, 5).Value = s.DateOfBirth?.ToString("dd/MM/yyyy") ?? "";     // Ngày sinh
                ws.Cell(r, 6).Value = s.EnrolledDate.ToString("dd/MM/yyyy");           // Ngày nhập học
                ws.Cell(r, 7).Value = s.Notes;                                         // Ghi chú
                ws.Cell(r, 8).Value = s.Classes;                                       // Lớp đang học
            }

            // Style read-only columns
            ws.Column(1).Style.Font.FontColor = XLColor.Gray;
            ws.Column(StudentEditableHeaders.Length + 2).Style.Font.FontColor = XLColor.Gray;
            ws.Columns().AdjustToContents();
            return ToBytes(wb);
        }

        // ── Xuất danh sách giáo viên ──────────────────────────────
        public async Task<byte[]> ExportTeachersAsync()
        {
            var teachers = await _db.Teachers
                .Where(t => t.IsActive)
                .OrderBy(t => t.FullName)
                .Select(t => new
                {
                    t.FullName, t.Subject, t.Phone, t.Email, t.Notes,
                    ClassCount = t.Classes.Count,
                    UserEmail = t.User != null ? t.User.Email : ""
                }).ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Danh sách giáo viên");
            var headers = new[] { "STT", "Họ tên", "Môn", "SĐT", "Email", "Số lớp", "Tài khoản", "Ghi chú" };
            for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
            StyleHeader(ws.Row(1));

            for (int i = 0; i < teachers.Count; i++)
            {
                var t = teachers[i];
                ws.Cell(i + 2, 1).Value = i + 1;
                ws.Cell(i + 2, 2).Value = t.FullName;
                ws.Cell(i + 2, 3).Value = t.Subject;
                ws.Cell(i + 2, 4).Value = t.Phone;
                ws.Cell(i + 2, 5).Value = t.Email;
                ws.Cell(i + 2, 6).Value = t.ClassCount;
                ws.Cell(i + 2, 7).Value = t.UserEmail;
                ws.Cell(i + 2, 8).Value = t.Notes;
            }
            ws.Columns().AdjustToContents();
            return ToBytes(wb);
        }

        // ── Xuất chi tiết 1 lớp (DS học sinh) — cùng canonical format ──
        public async Task<byte[]> ExportClassStudentsAsync(int classId)
        {
            var cls = await _db.Classes.Include(c => c.Teacher).FirstOrDefaultAsync(c => c.Id == classId);
            if (cls == null) return [];

            var students = await _db.StudentClasses
                .Where(sc => sc.ClassId == classId && sc.Student.IsActive)
                .OrderBy(sc => sc.Student.FullName)
                .Select(sc => new
                {
                    sc.Student.FullName, sc.Student.Address, sc.Student.ParentPhone,
                    sc.Student.DateOfBirth, sc.Student.EnrolledDate, sc.Student.Notes
                })
                .ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet($"Lớp {cls.Name}");

            // Metadata rows
            ws.Cell(1, 1).Value = $"Lớp {cls.Name} - {cls.Subject}";
            ws.Cell(1, 1).Style.Font.Bold = true; ws.Cell(1, 1).Style.Font.FontSize = 14;
            ws.Cell(2, 1).Value = $"GV: {cls.Teacher?.FullName ?? "Chưa có"} · {students.Count} học sinh";

            // Header row 4 — same canonical format
            ws.Cell(4, 1).Value = "STT";
            StyleReadOnlyHeader(ws.Cell(4, 1));
            for (int i = 0; i < StudentEditableHeaders.Length; i++)
                ws.Cell(4, i + 2).Value = StudentEditableHeaders[i];
            StyleHeader(ws.Row(4));
            StyleReadOnlyHeader(ws.Cell(4, 1));

            for (int i = 0; i < students.Count; i++)
            {
                var s = students[i];
                var r = i + 5;
                ws.Cell(r, 1).Value = i + 1;                                          // STT
                ws.Cell(r, 2).Value = s.FullName;                                      // Họ tên
                ws.Cell(r, 3).Value = s.Address;                                       // Địa chỉ
                ws.Cell(r, 4).Value = s.ParentPhone;                                   // SĐT phụ huynh
                ws.Cell(r, 5).Value = s.DateOfBirth?.ToString("dd/MM/yyyy") ?? "";     // Ngày sinh
                ws.Cell(r, 6).Value = s.EnrolledDate.ToString("dd/MM/yyyy");           // Ngày nhập học
                ws.Cell(r, 7).Value = s.Notes;                                         // Ghi chú
            }

            ws.Column(1).Style.Font.FontColor = XLColor.Gray;
            ws.Columns().AdjustToContents();
            return ToBytes(wb);
        }

        // ── Xuất điểm danh 1 lớp (tất cả buổi) ──────────────────
        public async Task<byte[]> ExportAttendanceAsync(int classId, int? month = null, int? year = null)
        {
            var cls = await _db.Classes.Include(c => c.Teacher).FirstOrDefaultAsync(c => c.Id == classId);
            if (cls == null) return [];

            var sessionsQuery = _db.Sessions.Where(s => s.ClassId == classId);
            if (month.HasValue && year.HasValue)
                sessionsQuery = sessionsQuery.Where(s => s.SessionDate.Month == month.Value && s.SessionDate.Year == year.Value);
            var sessions = await sessionsQuery.OrderBy(s => s.SessionDate).ToListAsync();

            var students = await _db.StudentClasses
                .Where(sc => sc.ClassId == classId && sc.Student.IsActive)
                .OrderBy(sc => sc.Student.FullName)
                .Select(sc => new { sc.StudentId, sc.Student.FullName })
                .ToListAsync();

            var attendances = await _db.Attendances
                .Where(a => a.Session.ClassId == classId)
                .ToListAsync();
            var attMap = attendances.ToDictionary(a => (a.StudentId, a.SessionId), a => new { a.Status, a.Reason });

            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet($"Điểm danh {cls.Name}");
            var monthLabel = month.HasValue && year.HasValue ? $" - Tháng {month}/{year}" : "";
            ws.Cell(1, 1).Value = $"Điểm danh lớp {cls.Name} - {cls.Subject}{monthLabel}";
            ws.Cell(1, 1).Style.Font.Bold = true; ws.Cell(1, 1).Style.Font.FontSize = 14;
            ws.Cell(2, 1).Value = $"GV: {cls.Teacher?.FullName ?? "Chưa có"} · {sessions.Count} buổi · {students.Count} HS";

            ws.Cell(4, 1).Value = "STT"; ws.Cell(4, 2).Value = "Họ tên";
            for (int j = 0; j < sessions.Count; j++)
            {
                ws.Cell(4, j + 3).Value = $"B{j + 1}\n{sessions[j].SessionDate:dd/MM}";
                ws.Cell(4, j + 3).Style.Alignment.WrapText = true;
                ws.Cell(4, j + 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }
            ws.Cell(4, sessions.Count + 3).Value = "Có mặt";
            ws.Cell(4, sessions.Count + 4).Value = "Vắng";
            ws.Cell(4, sessions.Count + 5).Value = "Có phép";
            StyleHeader(ws.Row(4));

            for (int i = 0; i < students.Count; i++)
            {
                var s = students[i];
                ws.Cell(i + 5, 1).Value = i + 1;
                ws.Cell(i + 5, 2).Value = s.FullName;
                int present = 0, absent = 0, excused = 0;

                for (int j = 0; j < sessions.Count; j++)
                {
                    var key = (s.StudentId, sessions[j].Id);
                    if (attMap.TryGetValue(key, out var att))
                    {
                        var cell = ws.Cell(i + 5, j + 3);
                        cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                        if (att.Status == "Present") { cell.Value = "✓"; cell.Style.Font.FontColor = XLColor.Green; present++; }
                        else if (att.Status == "Absent") { cell.Value = "✗"; cell.Style.Font.FontColor = XLColor.Red; absent++; }
                        else { cell.Value = "P"; cell.Style.Font.FontColor = XLColor.Orange; excused++; }
                    }
                    else
                    {
                        ws.Cell(i + 5, j + 3).Value = "✓";
                        ws.Cell(i + 5, j + 3).Style.Font.FontColor = XLColor.Green;
                        ws.Cell(i + 5, j + 3).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                        present++;
                    }
                }
                ws.Cell(i + 5, sessions.Count + 3).Value = present;
                ws.Cell(i + 5, sessions.Count + 4).Value = absent;
                ws.Cell(i + 5, sessions.Count + 5).Value = excused;
            }
            ws.Columns().AdjustToContents();
            ws.Column(2).Width = 20;
            return ToBytes(wb);
        }

        // ── Xuất trạng thái học phí ───────────────────────────────
        public async Task<byte[]> ExportPaymentsAsync(int? classId = null)
        {
            var query = _db.StudentClasses.Where(sc => sc.Student.IsActive);
            if (classId.HasValue)
                query = query.Where(sc => sc.ClassId == classId.Value);

            var enrollments = await query
                .Select(sc => new
                {
                    sc.StudentId, StudentName = sc.Student.FullName,
                    ParentPhone = sc.Student.ParentPhone,
                    sc.ClassId, ClassName = sc.Class.Name, Subject = sc.Class.Subject,
                    TuitionFee = sc.Class.TuitionFee ?? 0,
                    Payment = _db.Payments
                        .Where(p => p.StudentId == sc.StudentId && p.ClassId == sc.ClassId)
                        .Select(p => new { p.Amount, p.PaidDate, p.Notes })
                        .FirstOrDefault()
                })
                .OrderBy(x => x.StudentName).ThenBy(x => x.ClassName)
                .ToListAsync();

            using var wb = new XLWorkbook();
            var ws = wb.AddWorksheet("Học phí");
            var headers = new[] { "STT", "Học sinh", "SĐT PH", "Lớp", "Môn", "Học phí", "Trạng thái", "Số tiền đóng", "Ngày đóng", "Ghi chú" };
            for (int i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
            StyleHeader(ws.Row(1));

            for (int i = 0; i < enrollments.Count; i++)
            {
                var e = enrollments[i];
                var paid = e.Payment != null;
                ws.Cell(i + 2, 1).Value = i + 1;
                ws.Cell(i + 2, 2).Value = e.StudentName;
                ws.Cell(i + 2, 3).Value = e.ParentPhone;
                ws.Cell(i + 2, 4).Value = e.ClassName;
                ws.Cell(i + 2, 5).Value = e.Subject;
                ws.Cell(i + 2, 6).Value = (double)e.TuitionFee;
                ws.Cell(i + 2, 7).Value = paid ? "Đã đóng" : "Chưa đóng";
                ws.Cell(i + 2, 7).Style.Font.FontColor = paid ? XLColor.Green : XLColor.Red;
                ws.Cell(i + 2, 8).Value = paid ? (double)e.Payment!.Amount : 0;
                ws.Cell(i + 2, 9).Value = paid ? e.Payment!.PaidDate.ToString("dd/MM/yyyy") : "";
                ws.Cell(i + 2, 10).Value = paid ? e.Payment!.Notes : "";
            }
            ws.Column(6).Style.NumberFormat.Format = "#,##0";
            ws.Column(8).Style.NumberFormat.Format = "#,##0";
            ws.Columns().AdjustToContents();
            return ToBytes(wb);
        }

        private static byte[] ToBytes(XLWorkbook wb)
        {
            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }
    }
}
