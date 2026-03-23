using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/reports")]
    [Authorize(Roles = "admin")]
    public class ReportsController : ControllerBase
    {
        private readonly ReportService _svc;
        public ReportsController(ReportService svc) => _svc = svc;

        // GET /api/reports/summary?period=month&year=2026&month=3
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary(
            [FromQuery] string period = "month",
            [FromQuery] int year = 2026,
            [FromQuery] int month = 1,
            [FromQuery] int quarter = 1)
        {
            var result = await _svc.GetSummaryAsync(period, year, month, quarter);
            return Ok(result);
        }

        // GET /api/reports/chart?year=2026
        [HttpGet("chart")]
        public async Task<IActionResult> GetChart([FromQuery] int year = 2026)
        {
            var result = await _svc.GetChartDataAsync(year);
            return Ok(result);
        }

        // GET /api/reports/export?period=month&year=2026&month=3
        [HttpGet("export")]
        public async Task<IActionResult> Export(
            [FromQuery] string period = "month",
            [FromQuery] int year = 2026,
            [FromQuery] int month = 1,
            [FromQuery] int quarter = 1)
        {
            var bytes = await _svc.ExportExcelAsync(period, year, month, quarter);
            var fileName = period switch
            {
                "quarter" => $"bao-cao-Q{quarter}-{year}.xlsx",
                "year"    => $"bao-cao-{year}.xlsx",
                _         => $"bao-cao-{month:D2}-{year}.xlsx",
            };
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
