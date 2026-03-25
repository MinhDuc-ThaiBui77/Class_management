using System.Security.Claims;
using ClassManager.API.Models;
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
        private readonly ExportService  _exportSvc;
        public StudentsController(StudentService svc, UserService userSvc, ImportService importSvc, ExportService exportSvc)
        { _svc = svc; _userSvc = userSvc; _importSvc = importSvc; _exportSvc = exportSvc; }

        private int    CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private string CallerRole    => User.FindFirstValue(ClaimTypes.Role)!;
        private bool   IsManagerUp   => Roles.IsAtLeast(CallerRole, Roles.Manager);

        private async Task<int?> CallerTeacherIdAsync() =>
            IsManagerUp ? null : await _userSvc.GetTeacherIdByUserIdAsync(CurrentUserId);

        // GET — manager+ xem tất cả, teacher chỉ xem HS trong lớp mình
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? search)
            => Ok(await _svc.GetAllAsync(search, await CallerTeacherIdAsync()));

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var s = await _svc.GetByIdAsync(id);
            return s == null ? NotFound() : Ok(s);
        }

        // POST — teacher tạo HS (để enroll vào lớp mình), manager+ tạo tự do
        [HttpPost]
        [Authorize(Roles = Roles.ManagerUp + "," + Roles.Teacher)]
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

        // PUT — teacher sửa info HS trong lớp mình, manager+ sửa tự do
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, StudentRequest req)
        {
            // Teacher chỉ sửa HS trong lớp mình
            if (!IsManagerUp)
            {
                var tid = await CallerTeacherIdAsync();
                if (!await _svc.IsStudentOfTeacherAsync(id, tid))
                    return Forbid();
            }
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

        // DELETE — manager+ only
        [HttpDelete("{id}")]
        [Authorize(Roles = Roles.ManagerUp)]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _svc.DeleteAsync(id);
            return ok ? NoContent() : NotFound();
        }

        [HttpGet("export")]
        public async Task<IActionResult> Export()
        {
            var bytes = await _exportSvc.ExportStudentsAsync(await CallerTeacherIdAsync());
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "danh-sach-hoc-sinh.xlsx");
        }

        [HttpGet("import-template")]
        public IActionResult GetImportTemplate()
        {
            var bytes = _importSvc.GenerateTemplate();
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "template-hoc-sinh.xlsx");
        }

        // POST import — teacher import HS (sẽ enroll qua classes endpoint), manager+ import tự do
        [HttpPost("import")]
        [Authorize(Roles = Roles.ManagerUp)]
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
