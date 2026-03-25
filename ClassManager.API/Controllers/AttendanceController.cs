using System.Security.Claims;
using ClassManager.API.Models;
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

        private int    CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private string CallerRole    => User.FindFirstValue(ClaimTypes.Role)!;
        private bool   IsManagerUp   => Roles.IsAtLeast(CallerRole, Roles.Manager);

        private async Task<int?> CallerTeacherIdAsync() =>
            IsManagerUp ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet("sessions")]
        public async Task<IActionResult> GetSessions([FromQuery] string? week = null)
        {
            var teacherId = await CallerTeacherIdAsync();
            if (week != null && DateTime.TryParse(week, out var weekStart))
                return Ok(await _svc.GetSessionsByWeekAsync(weekStart, teacherId));
            return Ok(await _svc.GetAllSessionsAsync(teacherId));
        }

        // Copy week: manager+
        [HttpGet("sessions/copy-preview")]
        [Authorize(Roles = Roles.ManagerUp)]
        public async Task<IActionResult> CopyPreview([FromQuery] string week)
        {
            if (!DateTime.TryParse(week, out var weekStart))
                return BadRequest(new { message = "Ngày không hợp lệ." });
            var result = await _svc.PreviewCopyWeekAsync(weekStart);
            return Ok(result);
        }

        [HttpPost("sessions/copy-week")]
        [Authorize(Roles = Roles.ManagerUp)]
        public async Task<IActionResult> CopyFromPreviousWeek([FromQuery] string week, [FromBody] List<int>? sessionIds = null)
        {
            if (!DateTime.TryParse(week, out var weekStart))
                return BadRequest(new { message = "Ngày không hợp lệ." });
            try
            {
                var result = await _svc.CopyFromPreviousWeekAsync(weekStart, sessionIds);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // Tạo buổi học: teacher tạo cho lớp mình, manager+ tạo tự do
        [HttpPost("sessions")]
        public async Task<IActionResult> CreateSession(SessionRequest req)
        {
            // Teacher chỉ tạo session cho lớp mình
            if (!IsManagerUp)
            {
                var tid = await CallerTeacherIdAsync();
                if (!await _svc.IsTeacherOfSessionClassAsync(req.ClassId, tid))
                    return Forbid();
            }
            try
            {
                var s = await _svc.CreateSessionAsync(req);
                return Ok(s);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // Xóa buổi học: manager+ only
        [HttpDelete("sessions/{id}")]
        [Authorize(Roles = Roles.ManagerUp)]
        public async Task<IActionResult> DeleteSession(int id)
        {
            var ok = await _svc.DeleteSessionAsync(id);
            return ok ? NoContent() : NotFound();
        }

        [HttpPut("sessions/{id}/topic")]
        public async Task<IActionResult> UpdateTopic(int id, UpdateTopicRequest req)
        {
            try
            {
                var teacherId = await CallerTeacherIdAsync();
                var result = await _svc.UpdateTopicAsync(id, req.Topic, teacherId);
                return result != null ? Ok(result) : NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("sessions/{sessionId}")]
        public async Task<IActionResult> GetForSession(int sessionId)
            => Ok(await _svc.GetAttendanceForSessionAsync(sessionId));

        // Điểm danh: tất cả role (teacher điểm danh lớp mình — service sẽ validate)
        [HttpPost]
        public async Task<IActionResult> Save(SaveAttendanceRequest req)
        {
            await _svc.SaveAttendanceAsync(req);
            return Ok(new { message = "Đã lưu điểm danh." });
        }
    }
}
