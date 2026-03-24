using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/payments")]
    [Authorize]
    public class PaymentsController : ControllerBase
    {
        private readonly PaymentService _svc;
        private readonly UserService    _userSvc;
        private readonly ExportService  _exportSvc;
        public PaymentsController(PaymentService svc, UserService userSvc, ExportService exportSvc) { _svc = svc; _userSvc = userSvc; _exportSvc = exportSvc; }

        private int  CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private bool IsAdmin       => User.IsInRole("admin");

        private async Task<int?> CallerTeacherIdAsync() =>
            IsAdmin ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] int? classId = null)
        {
            var bytes = await _exportSvc.ExportPaymentsAsync(classId);
            var name = classId.HasValue ? $"hoc-phi-lop-{classId}.xlsx" : "hoc-phi.xlsx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _svc.GetPaymentStatusAsync(await CallerTeacherIdAsync()));
        }

        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Record(PaymentRequest req)
        {
            try
            {
                var p = await _svc.RecordPaymentAsync(req);
                return Ok(p);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _svc.DeletePaymentAsync(id);
            return ok ? NoContent() : NotFound();
        }
    }
}
