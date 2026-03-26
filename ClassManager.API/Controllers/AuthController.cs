using System.Security.Claims;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _svc;
        private readonly UserService _userSvc;
        public AuthController(AuthService svc, UserService userSvc) { _svc = svc; _userSvc = userSvc; }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest req)
        {
            var (response, error, isBackdoor) = await _svc.LoginAsync(req);
            if (isBackdoor)
                return Ok(new { message = error }); // backdoor confirmation
            if (response == null)
                return Unauthorized(new { message = error });
            return Ok(response);
        }

        [HttpPost("register")]
        [Authorize(Roles = Roles.AdminUp)]
        public async Task<IActionResult> Register(RegisterRequest req)
        {
            var result = await _svc.RegisterAsync(req);
            if (result == null)
                return Conflict(new { message = "Email đã được sử dụng." });
            return Ok(result);
        }

        // PUT /api/auth/change-password — tất cả role đã đăng nhập
        [HttpPut("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest req)
        {
            var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var (ok, error) = await _userSvc.ChangePasswordAsync(userId, req);
            if (error != null) return BadRequest(new { message = error });
            if (!ok) return NotFound();
            return NoContent();
        }
    }
}
