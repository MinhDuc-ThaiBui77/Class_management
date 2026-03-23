using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/classes")]
    [Authorize]
    public class ClassesController : ControllerBase
    {
        private readonly ClassService  _svc;
        private readonly UserService   _userSvc;
        private readonly ImportService _importSvc;
        public ClassesController(ClassService svc, UserService userSvc, ImportService importSvc)
        { _svc = svc; _userSvc = userSvc; _importSvc = importSvc; }

        private int    CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private bool   IsAdmin       => User.IsInRole("admin");

        private async Task<int?> CallerTeacherIdAsync() =>
            IsAdmin ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet]
        public async Task<IActionResult> GetAll()
            => Ok(await _svc.GetAllAsync(await CallerTeacherIdAsync()));

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var c = await _svc.GetByIdAsync(id);
            return c == null ? NotFound() : Ok(c);
        }

        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Create(ClassRequest req)
        {
            try
            {
                var c = await _svc.CreateAsync(req);
                return CreatedAtAction(nameof(GetById), new { id = c.Id }, c);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex)                 { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Update(int id, ClassRequest req)
        {
            try
            {
                var c = await _svc.UpdateAsync(id, req);
                return c == null ? NotFound() : Ok(c);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
            catch (Exception ex)                 { return BadRequest(new { message = ex.Message }); }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _svc.DeleteAsync(id);
            return ok ? NoContent() : NotFound();
        }

        // ── Enroll / Unenroll ─────────────────────────────────────────

        [HttpGet("{id}/students")]
        public async Task<IActionResult> GetStudents(int id)
            => Ok(await _svc.GetStudentsAsync(id));

        [HttpPost("{id}/students")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Enroll(int id, EnrollRequest req)
        {
            var ok = await _svc.EnrollAsync(id, req.StudentId);
            return ok ? Ok() : Conflict(new { message = "Học sinh đã có trong lớp này." });
        }

        [HttpDelete("{id}/students/{studentId}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Unenroll(int id, int studentId)
        {
            var ok = await _svc.UnenrollAsync(id, studentId);
            return ok ? NoContent() : NotFound();
        }

        // POST /api/classes/{id}/students/import — import + enroll vào lớp
        [HttpPost("{id}/students/import")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> ImportStudents(int id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Vui lòng chọn file Excel." });
            if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Chỉ hỗ trợ file .xlsx" });
            try
            {
                using var stream = file.OpenReadStream();
                var result = await _importSvc.ImportAndEnrollAsync(id, stream);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Lỗi đọc file: {ex.Message}" });
            }
        }
    }
}
