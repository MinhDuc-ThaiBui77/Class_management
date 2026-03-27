using System.Security.Claims;
using ClassManager.API.Models;
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

        private int    CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private string CallerRole    => User.FindFirstValue(ClaimTypes.Role)!;
        private string CallerName    => User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? "";
        private bool   IsManagerUp   => Roles.IsAtLeast(CallerRole, Roles.Manager);

        private async Task<int?> CallerTeacherIdAsync() =>
            IsManagerUp ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet("export")]
        public async Task<IActionResult> Export([FromQuery] int? classId = null)
        {
            var bytes = await _exportSvc.ExportPaymentsAsync(classId);
            var name = classId.HasValue ? $"hoc-phi-lop-{classId}.xlsx" : "hoc-phi.xlsx";
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name);
        }

        // GET logs — admin+ only (phải đặt TRƯỚC [HttpGet] để tránh routing conflict với {id})
        [HttpGet("logs")]
        [Authorize(Roles = Roles.AdminUp)]
        public async Task<IActionResult> GetLogs()
        {
            return Ok(await _svc.GetLogsAsync());
        }

        // GET — teacher thấy lớp mình, manager+ thấy tất cả
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _svc.GetPaymentStatusAsync(await CallerTeacherIdAsync()));
        }

        // POST — teacher ghi nhận thanh toán lớp mình, manager+ ghi nhận tự do
        [HttpPost]
        public async Task<IActionResult> Record(PaymentRequest req)
        {
            // Teacher chỉ ghi nhận cho lớp mình
            if (!IsManagerUp)
            {
                var tid = await CallerTeacherIdAsync();
                if (!await _svc.IsTeacherOfPaymentClassAsync(req.ClassId, tid))
                    return Forbid();
            }
            try
            {
                var p = await _svc.RecordPaymentAsync(req, CurrentUserId, CallerName);
                return Ok(p);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // DELETE — teacher xóa lớp mình, manager+ xóa tự do
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id, [FromQuery] string reason = "")
        {
            if (!IsManagerUp)
            {
                var tid = await CallerTeacherIdAsync();
                if (!await _svc.IsTeacherOfPaymentAsync(id, tid))
                    return Forbid();
            }
            var ok = await _svc.DeletePaymentAsync(id, CurrentUserId, CallerName, reason);
            return ok ? NoContent() : NotFound();
        }

    }
}
