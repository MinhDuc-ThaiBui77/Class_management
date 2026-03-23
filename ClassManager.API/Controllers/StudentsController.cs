using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/students")]
    [Authorize]
    public class StudentsController : ControllerBase
    {
        private readonly StudentService _svc;
        private readonly UserService    _userSvc;
        private readonly ImportService  _importSvc;
        public StudentsController(StudentService svc, UserService userSvc, ImportService importSvc)
        { _svc = svc; _userSvc = userSvc; _importSvc = importSvc; }

        private int  CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private bool IsAdmin       => User.IsInRole("admin");

        private async Task<int?> CallerTeacherIdAsync() =>
            IsAdmin ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? search)
            => Ok(await _svc.GetAllAsync(search, await CallerTeacherIdAsync()));

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var s = await _svc.GetByIdAsync(id);
            return s == null ? NotFound() : Ok(s);
        }

        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Create(StudentRequest req)
        {
            try
            {
                var s = await _svc.CreateAsync(req);
                return CreatedAtAction(nameof(GetById), new { id = s.Id }, s);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Update(int id, StudentRequest req)
        {
            try
            {
                var s = await _svc.UpdateAsync(id, req);
                return s == null ? NotFound() : Ok(s);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _svc.DeleteAsync(id);
            return ok ? NoContent() : NotFound();
        }

        // GET /api/students/import-template — tải file Excel mẫu
        [HttpGet("import-template")]
        [Authorize(Roles = "admin")]
        public IActionResult GetImportTemplate()
        {
            var bytes = _importSvc.GenerateTemplate();
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "template-hoc-sinh.xlsx");
        }

        // POST /api/students/import — import danh sách học sinh
        [HttpPost("import")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Import(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Vui lòng chọn file Excel." });
            if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Chỉ hỗ trợ file .xlsx" });
            try
            {
                using var stream = file.OpenReadStream();
                var (result, _) = await _importSvc.ImportStudentsAsync(stream);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Lỗi đọc file: {ex.Message}" });
            }
        }
    }
}
