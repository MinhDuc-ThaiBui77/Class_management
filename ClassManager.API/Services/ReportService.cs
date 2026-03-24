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

        private static (DateTime start, DateTime end) GetDateRange(string period, int year, int month, int quarter)
        {
            return period switch
            {
                "quarter" => (
                    new DateTime(year, ((quarter - 1) * 3) + 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(year, quarter * 3, DateTime.DaysInMonth(year, quarter * 3), 23, 59, 59, DateTimeKind.Utc)),
                "year" => (
                    new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc)),
                _ => (
                    new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc),
                    new DateTime(year, month, DateTime.DaysInMonth(year, month), 23, 59, 59, DateTimeKind.Utc)),
            };
        }

        // For teacher breakdown we still need month-based range
        private static (int sm, int sy, int em, int ey) GetMonthRange(string period, int year, int month, int quarter)
        {
            return period switch
            {
                "quarter" => (((quarter - 1) * 3) + 1, year, quarter * 3, year),
                "year"    => (1, year, 12, year),
                _         => (month, year, month, year),
            };
        }

        public async Task<ReportSummary> GetSummaryAsync(string period, int year, int month = 1, int quarter = 1)
        {
            var (startDate, endDate) = GetDateRange(period, year, month, quarter);
            var (sm, sy, em, ey) = GetMonthRange(period, year, month, quarter);

            // Revenue (không lọc IsActive — tiền đã thu là đã thu)
            var validRevenue = await _db.Payments
                .Where(p => p.ClassId > 0 && p.PaidDate >= startDate && p.PaidDate <= endDate)
                .SumAsync(p => (decimal?)p.Amount) ?? 0;

            var expectedRevenue = await _db.StudentClasses
                .Where(sc => sc.Student.IsActive)
                .SumAsync(sc => sc.Class.TuitionFee ?? 0);

            // Teacher + expense cost
            var teacherBreakdown = await GetTeacherBreakdownAsync(sm, sy, em, ey);
            var teacherCost = teacherBreakdown.Sum(t => t.Total);
            var expenseCost = await GetExpenseCostAsync(sm, sy, em, ey);
            var expenseBreakdown = await GetExpenseBreakdownAsync(sm, sy, em, ey);

            var totalCost = teacherCost + expenseCost;
            var profit = validRevenue - totalCost;

            // Collection rate (trên HS active)
            var activeEnrollments = await _db.StudentClasses
                .Where(sc => sc.Student.IsActive)
                .Select(sc => new { sc.StudentId, sc.ClassId })
                .ToListAsync();
            var activeSet = new HashSet<(int, int)>(activeEnrollments.Select(e => (e.StudentId, e.ClassId)));
            var totalEnrollments = activeEnrollments.Count;

            var allPaid = await _db.Payments
                .Where(p => p.ClassId > 0)
                .Select(p => new { p.StudentId, p.ClassId })
                .ToListAsync();
            var paidActiveCount = allPaid.Count(p => activeSet.Contains((p.StudentId, p.ClassId)));
            var collectionRate = totalEnrollments > 0
                ? Math.Round((decimal)paidActiveCount / totalEnrollments * 100, 1) : 0;

            var totalActiveStudents = await _db.Students.CountAsync(s => s.IsActive);
            var enrolledStudentCount = activeEnrollments.Select(e => e.StudentId).Distinct().Count();
            var noClassStudents = totalActiveStudents - enrolledStudentCount;

            return new ReportSummary(
                validRevenue, expectedRevenue, teacherCost, expenseCost, totalCost, profit,
                totalEnrollments, paidActiveCount, noClassStudents, collectionRate,
                teacherBreakdown, expenseBreakdown);
        }

        public async Task<List<MonthlyReportItem>> GetChartDataAsync(int year)
        {
            var yearStart = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var yearEnd = new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc);

            // Revenue: tất cả payment — KHÔNG lọc IsActive (tiền đã thu là đã thu)
            var revenueByMonth = await _db.Payments
                .Where(p => p.ClassId > 0 && p.PaidDate >= yearStart && p.PaidDate <= yearEnd)
                .GroupBy(p => p.PaidDate.Month)
                .Select(g => new { Month = g.Key, Total = g.Sum(p => p.Amount) })
                .ToDictionaryAsync(x => x.Month, x => x.Total);

            // Teacher cost: Lương = Số HS × 35k × 75% per session
            const decimal RATE = 35000m * 0.75m; // = 26,250 per student per session
            var sessionsByClassMonth = await _db.Sessions
                .Where(s => s.SessionDate >= yearStart && s.SessionDate <= yearEnd && s.Class.TeacherId != null)
                .GroupBy(s => new { Month = s.SessionDate.Month, s.ClassId })
                .Select(g => new { g.Key.Month, g.Key.ClassId, Count = g.Count() })
                .ToListAsync();

            var classStudentCounts = await _db.Classes
                .Where(c => c.TeacherId != null)
                .Select(c => new { c.Id, StudentCount = c.StudentClasses.Count(sc => sc.Student.IsActive) })
                .ToDictionaryAsync(c => c.Id, c => c.StudentCount);

            // 1 query: expenses
            var nonRecurringByMonth = await _db.Expenses
                .Where(e => !e.IsRecurring && e.ExpenseDate >= yearStart && e.ExpenseDate <= yearEnd)
                .GroupBy(e => e.ExpenseDate.Month)
                .Select(g => new { Month = g.Key, Total = g.Sum(e => e.Amount) })
                .ToDictionaryAsync(x => x.Month, x => x.Total);

            var recurringMonthly = await _db.Expenses
                .Where(e => e.IsRecurring)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

            var result = new List<MonthlyReportItem>();
            for (int m = 1; m <= 12; m++)
            {
                var revenue = revenueByMonth.GetValueOrDefault(m, 0);

                var teacherCost = sessionsByClassMonth
                    .Where(s => s.Month == m && classStudentCounts.ContainsKey(s.ClassId))
                    .Sum(s => s.Count * classStudentCounts[s.ClassId] * RATE);

                var expenseCost = nonRecurringByMonth.GetValueOrDefault(m, 0) + recurringMonthly;
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
                "quarter" => $"Quy {quarter}/{year}",
                "year"    => $"Nam {year}",
                _         => $"Thang {month}/{year}",
            };

            using var wb = new XLWorkbook();

            // Sheet 1: Tong quan
            var ws1 = wb.AddWorksheet("Tong quan");
            ws1.Cell(1, 1).Value = $"BAO CAO TAI CHINH - {periodLabel}";
            ws1.Cell(1, 1).Style.Font.Bold = true;
            ws1.Cell(1, 1).Style.Font.FontSize = 14;

            ws1.Cell(3, 1).Value = "Doanh thu";          ws1.Cell(3, 2).Value = (double)summary.Revenue;
            ws1.Cell(4, 1).Value = "Chi phi giao vien";  ws1.Cell(4, 2).Value = (double)summary.TeacherCost;
            ws1.Cell(5, 1).Value = "Chi phi khac";       ws1.Cell(5, 2).Value = (double)summary.ExpenseCost;
            ws1.Cell(6, 1).Value = "Tong chi phi";       ws1.Cell(6, 2).Value = (double)summary.TotalCost;
            ws1.Cell(7, 1).Value = "Loi nhuan";          ws1.Cell(7, 2).Value = (double)summary.Profit;
            ws1.Cell(8, 1).Value = "Ty le thu hoc phi";  ws1.Cell(8, 2).Value = $"{summary.CollectionRate}%";

            ws1.Column(2).Style.NumberFormat.Format = "#,##0";
            ws1.Range("A3:A8").Style.Font.Bold = true;

            // Sheet 2: Luong GV
            var ws2 = wb.AddWorksheet("Luong giao vien");
            var headers2 = new[] { "Giao vien", "Mon", "So buoi", "Luong/buoi", "Thanh tien" };
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

            // Sheet 3: Chi phi khac
            var ws3 = wb.AddWorksheet("Chi phi khac");
            var headers3 = new[] { "Khoan muc", "So tien", "Ngay", "Co dinh", "Ghi chu" };
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
                ws3.Cell(i + 2, 4).Value = e.IsRecurring ? "Co" : "Khong";
                ws3.Cell(i + 2, 5).Value = e.Notes;
            }
            ws3.Columns().AdjustToContents();

            using var ms = new MemoryStream();
            wb.SaveAs(ms);
            return ms.ToArray();
        }

        // -- Helpers --

        private async Task<List<TeacherCostItem>> GetTeacherBreakdownAsync(int sm, int sy, int em, int ey)
        {
            var startDate = new DateTime(sy, sm, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(ey, em, DateTime.DaysInMonth(ey, em), 23, 59, 59, DateTimeKind.Utc);

            // Công thức: Lương GV/buổi = Số HS × 35,000 × 75%
            const decimal RATE_PER_STUDENT = 35000m;
            const decimal TEACHER_SHARE = 0.75m;

            var classData = await _db.Classes
                .Where(c => c.TeacherId != null)
                .Select(c => new
                {
                    TeacherId = c.TeacherId!.Value,
                    TeacherName = c.Teacher!.FullName,
                    c.Subject,
                    ClassName = c.Name,
                    StudentCount = c.StudentClasses.Count(sc => sc.Student.IsActive),
                    SessionCount = c.Sessions.Count(s => s.SessionDate >= startDate && s.SessionDate <= endDate)
                })
                .ToListAsync();

            return classData
                .Where(c => c.SessionCount > 0)
                .GroupBy(c => new { c.TeacherId, c.TeacherName, c.Subject })
                .Select(g =>
                {
                    var totalSessions = g.Sum(c => c.SessionCount);
                    var salaryPerSession = g.Sum(c => c.StudentCount * RATE_PER_STUDENT * TEACHER_SHARE * c.SessionCount) / (totalSessions > 0 ? totalSessions : 1);
                    var total = g.Sum(c => c.SessionCount * c.StudentCount * RATE_PER_STUDENT * TEACHER_SHARE);
                    return new TeacherCostItem(g.Key.TeacherId, g.Key.TeacherName, g.Key.Subject,
                        totalSessions, Math.Round(salaryPerSession), Math.Round(total));
                })
                .ToList();
        }

        private async Task<decimal> GetExpenseCostAsync(int sm, int sy, int em, int ey)
        {
            var startDate = new DateTime(sy, sm, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(ey, em, DateTime.DaysInMonth(ey, em), 23, 59, 59, DateTimeKind.Utc);
            var monthCount = ((ey - sy) * 12) + (em - sm) + 1;

            var nonRecurring = await _db.Expenses
                .Where(e => !e.IsRecurring && e.ExpenseDate >= startDate && e.ExpenseDate <= endDate)
                .SumAsync(e => (decimal?)e.Amount) ?? 0;

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
