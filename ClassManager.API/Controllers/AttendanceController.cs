using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/attendance")]
    [Authorize]
    public class AttendanceController : ControllerBase
    {
        private readonly AttendanceService _svc;
        private readonly UserService       _userSvc;
        public AttendanceController(AttendanceService svc, UserService userSvc) { _svc = svc; _userSvc = userSvc; }

        private int  CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private bool IsAdmin       => User.IsInRole("admin");

        private async Task<int?> CallerTeacherIdAsync() =>
            IsAdmin ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions()
            => Ok(await _svc.GetAllSessionsAsync(await CallerTeacherIdAsync()));

        [HttpPost("sessions")]
        public async Task<IActionResult> CreateSession(SessionRequest req)
        {
            try
            {
                var teacherId = await CallerTeacherIdAsync();
                var s = await _svc.CreateSessionAsync(req, teacherId);
                return Ok(s);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("sessions/{id}")]
        public async Task<IActionResult> DeleteSession(int id)
        {
            var ok = await _svc.DeleteSessionAsync(id);
            return ok ? NoContent() : NotFound();
        }

        [HttpGet("sessions/{sessionId}")]
        public async Task<IActionResult> GetForSession(int sessionId)
            => Ok(await _svc.GetAttendanceForSessionAsync(sessionId));

        [HttpPost]
        public async Task<IActionResult> Save(SaveAttendanceRequest req)
        {
            await _svc.SaveAttendanceAsync(req);
            return Ok(new { message = "Đã lưu điểm danh." });
        }
    }
}
