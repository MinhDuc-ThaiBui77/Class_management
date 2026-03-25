using System.Security.Claims;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize(Roles = Roles.AdminUp)]
    public class UsersController : ControllerBase
    {
        private readonly UserService _svc;
        public UsersController(UserService svc) => _svc = svc;

        private int    CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private string CallerRole    => User.FindFirstValue(ClaimTypes.Role)!;

        [HttpGet]
        public async Task<IActionResult> GetAll() =>
            Ok(await _svc.GetAllAsync(CallerRole));

        [HttpGet("available-teachers")]
        public async Task<IActionResult> GetAvailableTeachers([FromQuery] int? forUserId = null) =>
            Ok(await _svc.GetAvailableTeachersAsync(forUserId));

        [HttpPost]
        public async Task<IActionResult> Create(CreateUserRequest req)
        {
            var (user, error) = await _svc.CreateAsync(req, CallerRole);
            if (error != null) return BadRequest(new { message = error });
            return Ok(user);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateUserRequest req)
        {
            var (user, error) = await _svc.UpdateAsync(id, req, CurrentUserId, CallerRole);
            if (error != null) return BadRequest(new { message = error });
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpPost("{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, ResetPasswordRequest req)
        {
            var (ok, error) = await _svc.ResetPasswordAsync(id, req, CurrentUserId, CallerRole);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }

        [HttpPatch("{id}/toggle")]
        public async Task<IActionResult> ToggleActive(int id)
        {
            var (user, error) = await _svc.ToggleActiveAsync(id, CurrentUserId, CallerRole);
            if (error != null) return BadRequest(new { message = error });
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var (ok, error) = await _svc.DeleteAsync(id, CurrentUserId, CallerRole);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }

        // PUT /api/users/me/password — tất cả role
        [HttpPut("me/password")]
        [Authorize] // override class-level: mọi role đều được đổi mật khẩu chính mình
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
        {
            var (ok, error) = await _svc.ChangePasswordAsync(CurrentUserId, req);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
