using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class ExpenseService
    {
        private readonly AppDbContext _db;
        public ExpenseService(AppDbContext db) => _db = db;

        public async Task<List<ExpenseResponse>> GetAllAsync(int? month = null, int? year = null)
        {
            var query = _db.Expenses.AsQueryable();
            if (month.HasValue && year.HasValue)
            {
                // Chi phí phát sinh trong tháng + chi phí cố định (recurring)
                query = query.Where(e =>
                    (e.ExpenseDate.Month == month.Value && e.ExpenseDate.Year == year.Value)
                    || e.IsRecurring);
            }
            return await query
                .OrderByDescending(e => e.ExpenseDate)
                .Select(e => new ExpenseResponse(e.Id, e.Title, e.Amount, e.ExpenseDate, e.IsRecurring, e.Notes))
                .ToListAsync();
        }

        public async Task<ExpenseResponse> CreateAsync(ExpenseRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Title))
                throw new InvalidOperationException("Tên chi phí không được để trống.");
            if (req.Amount <= 0)
                throw new InvalidOperationException("Số tiền phải lớn hơn 0.");

            var expense = new Expense
            {
                Title       = req.Title.Trim(),
                Amount      = req.Amount,
                ExpenseDate = DateTime.SpecifyKind(req.ExpenseDate, DateTimeKind.Utc),
                IsRecurring = req.IsRecurring,
                Notes       = req.Notes.Trim(),
            };
            _db.Expenses.Add(expense);
            await _db.SaveChangesAsync();
            return new ExpenseResponse(expense.Id, expense.Title, expense.Amount, expense.ExpenseDate, expense.IsRecurring, expense.Notes);
        }

        public async Task<ExpenseResponse?> UpdateAsync(int id, ExpenseRequest req)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return null;

            expense.Title       = req.Title.Trim();
            expense.Amount      = req.Amount;
            expense.ExpenseDate = DateTime.SpecifyKind(req.ExpenseDate, DateTimeKind.Utc);
            expense.IsRecurring = req.IsRecurring;
            expense.Notes       = req.Notes.Trim();
            await _db.SaveChangesAsync();
            return new ExpenseResponse(expense.Id, expense.Title, expense.Amount, expense.ExpenseDate, expense.IsRecurring, expense.Notes);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var expense = await _db.Expenses.FindAsync(id);
            if (expense == null) return false;
            _db.Expenses.Remove(expense);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
