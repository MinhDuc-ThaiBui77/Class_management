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

        public async Task<MonthlyPaymentResponse> GetMonthlyStatusAsync(int month, int year, int? teacherId = null)
        {
            var studentQuery = _db.Students.Where(s => s.IsActive);
            if (teacherId.HasValue)
            {
                var studentIds = await _db.StudentClasses
                    .Where(sc => sc.Class.TeacherId == teacherId.Value)
                    .Select(sc => sc.StudentId)
                    .Distinct()
                    .ToListAsync();
                studentQuery = studentQuery.Where(s => studentIds.Contains(s.Id));
            }
            var students = await studentQuery.OrderBy(s => s.FullName).ToListAsync();

            var payments = await _db.Payments
                .Where(p => p.MonthOf == month && p.YearOf == year)
                .ToDictionaryAsync(p => p.StudentId);

            var items = students.Select(s =>
            {
                var hasPaid = payments.TryGetValue(s.Id, out var p);
                return new PaymentStatusItem(
                    s.Id, s.FullName,
                    hasPaid,
                    hasPaid ? p!.Amount : 0,
                    hasPaid ? p!.PaidDate : null,
                    hasPaid ? p!.Notes : ""
                );
            }).ToList();

            return new MonthlyPaymentResponse(
                month, year, items,
                items.Where(i => i.IsPaid).Sum(i => i.Amount),
                items.Count(i => !i.IsPaid)
            );
        }

        public async Task<Payment> RecordPaymentAsync(PaymentRequest req)
        {
            if (req.Amount <= 0)
                throw new InvalidOperationException("Số tiền phải lớn hơn 0.");

            var exists = await _db.Payments.AnyAsync(p =>
                p.StudentId == req.StudentId &&
                p.MonthOf   == req.MonthOf &&
                p.YearOf    == req.YearOf);

            if (exists)
                throw new InvalidOperationException(
                    $"Học sinh này đã đóng học phí tháng {req.MonthOf}/{req.YearOf}.");

            var payment = new Payment
            {
                StudentId = req.StudentId,
                Amount    = req.Amount,
                MonthOf   = req.MonthOf,
                YearOf    = req.YearOf,
                PaidDate  = DateTime.UtcNow,
                Notes     = req.Notes,
            };
            _db.Payments.Add(payment);
            await _db.SaveChangesAsync();
            return payment;
        }

        public async Task<bool> DeletePaymentAsync(int id)
        {
            var payment = await _db.Payments.FindAsync(id);
            if (payment == null) return false;
            _db.Payments.Remove(payment);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
