using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class PaymentService
    {
        private readonly AppDbContext _db;
        public PaymentService(AppDbContext db) => _db = db;

        public async Task<PaymentListResponse> GetPaymentStatusAsync(int? teacherId = null)
        {
            var query = _db.StudentClasses
                .Where(sc => sc.Student.IsActive);

            if (teacherId.HasValue)
                query = query.Where(sc => sc.Class.TeacherId == teacherId.Value);

            var enrollments = await query
                .Select(sc => new
                {
                    sc.StudentId,
                    StudentName = sc.Student.FullName,
                    ParentPhone = sc.Student.ParentPhone,
                    sc.ClassId,
                    ClassName = sc.Class.Name,
                    Subject = sc.Class.Subject,
                    TeacherName = sc.Class.Teacher != null ? sc.Class.Teacher.FullName : null,
                    TuitionFee = sc.Class.TuitionFee ?? 0,
                    Payment = _db.Payments
                        .Where(p => p.StudentId == sc.StudentId && p.ClassId == sc.ClassId)
                        .Select(p => new { p.Id, p.Amount, p.PaidDate, p.Notes })
                        .FirstOrDefault()
                })
                .OrderBy(x => x.StudentName)
                .ThenBy(x => x.ClassName)
                .ToListAsync();

            var items = enrollments.Select(e => new PaymentStatusItem(
                e.StudentId,
                e.StudentName,
                e.ClassId,
                e.ClassName,
                e.Subject,
                e.TeacherName,
                e.ParentPhone,
                e.TuitionFee,
                true,
                e.Payment != null,
                e.Payment?.Id,
                e.Payment?.Amount ?? 0,
                e.Payment?.PaidDate,
                e.Payment?.Notes ?? ""
            )).ToList();

            // Thêm HS active chưa có lớp (chỉ admin mới thấy toàn bộ)
            if (!teacherId.HasValue)
            {
                var enrolledIds = items.Select(i => i.StudentId).Distinct().ToHashSet();
                var noClassStudents = await _db.Students
                    .Where(s => s.IsActive && !enrolledIds.Contains(s.Id))
                    .OrderBy(s => s.FullName)
                    .Select(s => new { s.Id, s.FullName, s.ParentPhone })
                    .ToListAsync();

                foreach (var s in noClassStudents)
                {
                    items.Add(new PaymentStatusItem(
                        s.Id, s.FullName, 0, null, null, null, s.ParentPhone,
                        0, false, false, null, 0, null, ""
                    ));
                }
            }

            return new PaymentListResponse(
                items,
                items.Where(i => i.IsPaid).Sum(i => i.Amount),
                items.Count(i => i.HasClass),
                items.Count(i => i.IsPaid),
                items.Count(i => !i.IsPaid && i.HasClass)
            );
        }

        /// <summary>Kiểm tra classId có thuộc teacher không</summary>
        public async Task<bool> IsTeacherOfPaymentClassAsync(int classId, int? teacherId)
        {
            if (teacherId == null) return false;
            return await _db.Classes.AnyAsync(c => c.Id == classId && c.TeacherId == teacherId.Value);
        }

        /// <summary>Kiểm tra payment có thuộc lớp của teacher không (dùng cho delete)</summary>
        public async Task<bool> IsTeacherOfPaymentAsync(int paymentId, int? teacherId)
        {
            if (teacherId == null) return false;
            return await _db.Payments
                .AnyAsync(p => p.Id == paymentId && p.Class.TeacherId == teacherId.Value);
        }

        public async Task<Payment> RecordPaymentAsync(PaymentRequest req, int userId, string userName)
        {
            if (req.Amount <= 0)
                throw new InvalidOperationException("Số tiền phải lớn hơn 0.");

            var enrolled = await _db.StudentClasses.AnyAsync(
                sc => sc.StudentId == req.StudentId && sc.ClassId == req.ClassId);
            if (!enrolled)
                throw new InvalidOperationException("Học sinh chưa đăng ký lớp này.");

            var exists = await _db.Payments.AnyAsync(
                p => p.StudentId == req.StudentId && p.ClassId == req.ClassId);
            if (exists)
                throw new InvalidOperationException("Học sinh đã đóng học phí cho lớp này.");

            var studentName = await _db.Students
                .Where(s => s.Id == req.StudentId)
                .Select(s => s.FullName)
                .FirstOrDefaultAsync() ?? "";
            var classLabel = await _db.Classes
                .Where(c => c.Id == req.ClassId)
                .Select(c => c.Name + " " + c.Subject)
                .FirstOrDefaultAsync() ?? "";

            var payment = new Payment
            {
                StudentId = req.StudentId,
                ClassId   = req.ClassId,
                Amount    = req.Amount,
                PaidDate  = DateTime.UtcNow,
                Notes     = req.Notes,
            };
            _db.Payments.Add(payment);
            _db.PaymentLogs.Add(new PaymentLog
            {
                UserId      = userId,
                UserName    = userName,
                Action      = "thu",
                StudentId   = req.StudentId,
                StudentName = studentName,
                ClassId     = req.ClassId,
                ClassName   = classLabel,
                Amount      = req.Amount,
                Reason      = "",
            });

            await _db.SaveChangesAsync();
            return payment;
        }

        public async Task<bool> DeletePaymentAsync(int id, int userId, string userName, string reason = "")
        {
            var payment = await _db.Payments
                .Include(p => p.Student)
                .Include(p => p.Class)
                .FirstOrDefaultAsync(p => p.Id == id);
            if (payment == null) return false;

            _db.PaymentLogs.Add(new PaymentLog
            {
                UserId      = userId,
                UserName    = userName,
                Action      = "hủy_thu",
                StudentId   = payment.StudentId,
                StudentName = payment.Student.FullName,
                ClassId     = payment.ClassId,
                ClassName   = $"{payment.Class.Name} {payment.Class.Subject}",
                Amount      = payment.Amount,
                Reason      = reason,
            });

            _db.Payments.Remove(payment);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<PaymentLogItem>> GetLogsAsync()
        {
            return await _db.PaymentLogs
                .OrderByDescending(l => l.CreatedAt)
                .Select(l => new PaymentLogItem(
                    l.Id, l.UserId, l.UserName, l.Action,
                    l.StudentName, l.ClassName, l.Amount, l.Reason, l.CreatedAt))
                .ToListAsync();
        }
    }
}
