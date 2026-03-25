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
        public AuthController(AuthService svc) => _svc = svc;

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest req)
        {
            var result = await _svc.LoginAsync(req);
            if (result == null)
                return Unauthorized(new { message = "Email hoặc mật khẩu không đúng." });
            return Ok(result);
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
    }
}
