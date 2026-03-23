using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly UserService _svc;
        public UsersController(UserService svc) => _svc = svc;

        private int CurrentUserId =>
            int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // GET /api/users — admin only
        [HttpGet]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> GetAll() =>
            Ok(await _svc.GetAllAsync());

        // GET /api/users/available-teachers — admin only
        // Trả về danh sách Teacher chưa link với user nào (hoặc đang link với userId được pass qua query)
        [HttpGet("available-teachers")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> GetAvailableTeachers([FromQuery] int? forUserId = null) =>
            Ok(await _svc.GetAvailableTeachersAsync(forUserId));

        // POST /api/users — admin only
        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Create(CreateUserRequest req)
        {
            var (user, error) = await _svc.CreateAsync(req);
            if (error != null) return BadRequest(new { message = error });
            return Ok(user);
        }

        // PUT /api/users/{id} — admin only
        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Update(int id, UpdateUserRequest req)
        {
            var (user, error) = await _svc.UpdateAsync(id, req, CurrentUserId);
            if (error != null) return BadRequest(new { message = error });
            if (user == null) return NotFound();
            return Ok(user);
        }

        // POST /api/users/{id}/reset-password — admin only
        [HttpPost("{id}/reset-password")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> ResetPassword(int id, ResetPasswordRequest req)
        {
            var (ok, error) = await _svc.ResetPasswordAsync(id, req, CurrentUserId);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }

        // PATCH /api/users/{id}/toggle — admin only (toggle IsActive)
        [HttpPatch("{id}/toggle")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> ToggleActive(int id)
        {
            var (user, error) = await _svc.ToggleActiveAsync(id, CurrentUserId);
            if (error != null) return BadRequest(new { message = error });
            if (user == null) return NotFound();
            return Ok(user);
        }

        // DELETE /api/users/{id} — admin only (xóa vĩnh viễn)
        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var (ok, error) = await _svc.DeleteAsync(id, CurrentUserId);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }

        // PUT /api/users/me/password — tất cả role
        [HttpPut("me/password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
        {
            var (ok, error) = await _svc.ChangePasswordAsync(CurrentUserId, req);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
