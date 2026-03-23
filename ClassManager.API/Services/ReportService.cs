using ClosedXML.Excel;
using ClassManager.API.Data;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class ReportService
    {
        private readonly AppDbContext _db;
        public ReportService(AppDbContext db) => _db = db;

        /// <summary>
        /// Lấy danh sách (startMonth, startYear) → (endMonth, endYear) theo period
        /// </summary>
        private static (int startMonth, int startYear, int endMonth, int endYear) GetRange(string period, int year, int month, int quarter)
        {
            return period switch
            {
                "quarter" => (((quarter - 1) * 3) + 1, year, quarter * 3, year),
                "year"    => (1, year, 12, year),
                _         => (month, year, month, year), // month
            };
        }

        public async Task<ReportSummary> GetSummaryAsync(string period, int year, int month = 1, int quarter = 1)
        {
            var (sm, sy, em, ey) = GetRange(period, year, month, quarter);

            // Revenue: tổng payments trong kỳ
            var revenue = await _db.Payments
                .Where(p => (p.YearOf > sy || (p.YearOf == sy && p.MonthOf >= sm))
                         && (p.YearOf < ey || (p.YearOf == ey && p.MonthOf <= em)))
                .SumAsync(p => (decimal?)p.Amount) ?? 0;

            // Expected revenue: tổng (tuitionFee × active students) cho tất cả lớp
            var classData = await _db.Classes
                .Select(c => new
                {
                    TuitionFee = c.TuitionFee ?? 0,
                    StudentCount = c.StudentClasses.Count(sc => sc.Student.IsActive)
                }).ToListAsync();
            var monthCount = ((ey - sy) * 12) + (em - sm) + 1;
            var expectedRevenue = classData.Sum(c => c.TuitionFee * c.StudentCount);

            // Teacher cost: sessions in period × salaryPerSession
            var teacherBreakdown = await GetTeacherBreakdownAsync(sm, sy, em, ey);
            var teacherCost = teacherBreakdown.Sum(t => t.Total);

            // Expense cost: recurring + non-recurring in period
            var expenseCost = await GetExpenseCostAsync(sm, sy, em, ey);
            var expenseBreakdown = await GetExpenseBreakdownAsync(sm, sy, em, ey);

            var totalCost = teacherCost + expenseCost;
            var profit = revenue - totalCost;

            // Collection rate
            var totalStudents = await _db.Students.CountAsync(s => s.IsActive);
            var paidStudentIds = await _db.Payments
                .Where(p => (p.YearOf > sy || (p.YearOf == sy && p.MonthOf >= sm))
                         && (p.YearOf < ey || (p.YearOf == ey && p.MonthOf <= em)))
                .Select(p => p.StudentId)
                .Distinct()
                .CountAsync();
            var collectionRate = totalStudents > 0 ? Math.Round((decimal)paidStudentIds / totalStudents * 100, 1) : 0;

            return new ReportSummary(
                revenue, expectedRevenue, teacherCost, expenseCost, totalCost, profit,
                totalStudents, paidStudentIds, collectionRate,
                teacherBreakdown, expenseBreakdown);
        }

        public async Task<List<MonthlyReportItem>> GetChartDataAsync(int year)
        {
            var result = new List<MonthlyReportItem>();
            for (int m = 1; m <= 12; m++)
            {
                var revenue = await _db.Payments
                    .Where(p => p.YearOf == year && p.MonthOf == m)
                    .SumAsync(p => (decimal?)p.Amount) ?? 0;

                var teacherBreakdown = await GetTeacherBreakdownAsync(m, year, m, year);
                var teacherCost = teacherBreakdown.Sum(t => t.Total);
                var expenseCost = await GetExpenseCostAsync(m, year, m, year);
                var totalCost = teacherCost + expenseCost;

                result.Add(new MonthlyReportItem(m, year, revenue, totalCost, revenue - totalCost));
            }
            return result;
        }

        public async Task<byte[]> ExportExcelAsync(string period, int year, int month = 1, int quarter = 1)
        {
            var summary = await GetSummaryAsync(period, year, month, quarter);
            var periodLabel = period switch
            {
                "quarter" => $"Quý {quarter}/{year}",
                "year"    => $"Năm {year}",
                _         => $"Tháng {month}/{year}",
            };

            using var wb = new XLWorkbook();

            // Sheet 1: Tổng quan
            var ws1 = wb.AddWorksheet("Tổng quan");
            ws1.Cell(1, 1).Value = $"BÁO CÁO TÀI CHÍNH - {periodLabel}";
            ws1.Cell(1, 1).Style.Font.Bold = true;
            ws1.Cell(1, 1).Style.Font.FontSize = 14;

            ws1.Cell(3, 1).Value = "Doanh thu";          ws1.Cell(3, 2).Value = (double)summary.Revenue;
            ws1.Cell(4, 1).Value = "Chi phí giáo viên";  ws1.Cell(4, 2).Value = (double)summary.TeacherCost;
            ws1.Cell(5, 1).Value = "Chi phí khác";       ws1.Cell(5, 2).Value = (double)summary.ExpenseCost;
            ws1.Cell(6, 1).Value = "Tổng chi phí";       ws1.Cell(6, 2).Value = (double)summary.TotalCost;
            ws1.Cell(7, 1).Value = "Lợi nhuận";          ws1.Cell(7, 2).Value = (double)summary.Profit;
            ws1.Cell(8, 1).Value = "Tỷ lệ thu học phí";  ws1.Cell(8, 2).Value = $"{summary.CollectionRate}%";

            ws1.Column(2).Style.NumberFormat.Format = "#,##0";
            ws1.Range("A3:A8").Style.Font.Bold = true;

            // Sheet 2: Chi tiết lương GV
            var ws2 = wb.AddWorksheet("Lương giáo viên");
            var headers2 = new[] { "Giáo viên", "Môn", "Số buổi", "Lương/buổi", "Thành tiền" };
            for (int i = 0; i < headers2.Length; i++)
            {
                ws2.Cell(1, i + 1).Value = headers2[i];
                ws2.Cell(1, i + 1).Style.Font.Bold = true;
                ws2.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            }
            for (int i = 0; i < summary.TeacherBreakdown.Count; i++)
            {
                var t = summary.TeacherBreakdown[i];
                ws2.Cell(i + 2, 1).Value = t.TeacherName;
                ws2.Cell(i + 2, 2).Value = t.Subject;
                ws2.Cell(i + 2, 3).Value = t.SessionCount;
                ws2.Cell(i + 2, 4).Value = (double)t.SalaryPerSession;
                ws2.Cell(i + 2, 5).Value = (double)t.Total;
            }
            ws2.Columns().AdjustToContents();

            // Sheet 3: Chi phí khác
            var ws3 = wb.AddWorksheet("Chi phí khác");
            var headers3 = new[] { "Khoản mục", "Số tiền", "Ngày", "Cố định", "Ghi chú" };
            for (int i = 0; i < headers3.Length; i++)
            {
                ws3.Cell(1, i + 1).Value = headers3[i];
                ws3.Cell(1, i + 1).Style.Font.Bold = true;
                ws3.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightBlue;
            }
            for (int i = 0; i < summary.ExpenseBreakdown.Count; i++)
            {
                var e = summary.ExpenseBreakdown[i];
                ws3.Cell(i + 2, 1).Value = e.Title;
                ws3.Cell(i + 2, 2).Value = (double)e.Amount;
                ws3.Cell(i + 2, 3).Value = e.ExpenseDate.ToString("dd/MM/yyyy");
                ws3.Cell(i + 2, 4).Value = e.IsRecurring ? "Có" : "Không";
                ws3.Cell(i + 2, 5).Value = e.Notes;
            }
            ws3.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }

        // ── Helpers ──────────────────────────────────────────────────

        private async Task<List<TeacherCostItem>> GetTeacherBreakdownAsync(int sm, int sy, int em, int ey)
        {
            var startDate = new DateTime(sy, sm, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(ey, em, DateTime.DaysInMonth(ey, em), 23, 59, 59, DateTimeKind.Utc);

            var teachers = await _db.Teachers
                .Where(t => t.IsActive)
                .Select(t => new
                {
                    t.Id,
                    t.FullName,
                    t.Subject,
                    SalaryPerSession = t.SalaryPerSession ?? 0,
                    SessionCount = t.Classes.SelectMany(c => c.Sessions)
                        .Count(s => s.SessionDate >= startDate && s.SessionDate <= endDate)
                })
                .ToListAsync();

            return teachers
                .Where(t => t.SessionCount > 0 || t.SalaryPerSession > 0)
                .Select(t => new TeacherCostItem(t.Id, t.FullName, t.Subject, t.SessionCount, t.SalaryPerSession, t.SessionCount * t.SalaryPerSession))
                .ToList();
        }

        private async Task<decimal> GetExpenseCostAsync(int sm, int sy, int em, int ey)
        {
            var startDate = new DateTime(sy, sm, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(ey, em, DateTime.DaysInMonth(ey, em), 23, 59, 59, DateTimeKind.Utc);
            var monthCount = ((ey - sy) * 12) + (em - sm) + 1;

            // Non-recurring expenses in range
            var nonRecurring = await _db.Expenses
                .Where(e => !e.IsRecurring && e.ExpenseDate >= startDate && e.ExpenseDate <= endDate)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            // Recurring expenses: amount × number of months in range
            var recurringMonthly = await _db.Expenses
                .Where(e => e.IsRecurring)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            return nonRecurring + (recurringMonthly * monthCount);
        }

        private async Task<List<ExpenseResponse>> GetExpenseBreakdownAsync(int sm, int sy, int em, int ey)
        {
            var startDate = new DateTime(sy, sm, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(ey, em, DateTime.DaysInMonth(ey, em), 23, 59, 59, DateTimeKind.Utc);

            return await _db.Expenses
                .Where(e => e.IsRecurring || (e.ExpenseDate >= startDate && e.ExpenseDate <= endDate))
                .OrderByDescending(e => e.ExpenseDate)
                .Select(e => new ExpenseResponse(e.Id, e.Title, e.Amount, e.ExpenseDate, e.IsRecurring, e.Notes))
                .ToListAsync();
        }
    }
}
