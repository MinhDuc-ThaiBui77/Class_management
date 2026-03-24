using System.Security.Claims;
using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/teachers")]
    [Authorize]
    public class TeachersController : ControllerBase
    {
        private readonly TeacherService _svc;
        private readonly UserService    _userSvc;
        private readonly ExportService  _exportSvc;
        public TeachersController(TeacherService svc, UserService userSvc, ExportService exportSvc) { _svc = svc; _userSvc = userSvc; _exportSvc = exportSvc; }

        private int  CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private bool IsAdmin       => User.IsInRole("admin");

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Admin thấy tất cả, teacher chỉ thấy bản thân
            var userId = IsAdmin ? (int?)null : CurrentUserId;
            return Ok(await _svc.GetAllAsync(userId));
        }

        [HttpGet("export")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Export()
        {
            var bytes = await _exportSvc.ExportTeachersAsync();
            return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "danh-sach-giao-vien.xlsx");
        }

        [HttpGet("subjects")]
        public IActionResult GetSubjects() => Ok(SubjectList.Valid);

        [HttpGet("available-users")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> GetAvailableUsers() => Ok(await _svc.GetAvailableUsersAsync());

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var t = await _svc.GetByIdAsync(id);
            return t == null ? NotFound() : Ok(t);
        }

        [HttpPost]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Create(TeacherRequest req)
        {
            try
            {
                var t = await _svc.CreateAsync(req);
                return CreatedAtAction(nameof(GetById), new { id = t.Id }, t);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "admin")]
        public async Task<IActionResult> Update(int id, TeacherRequest req)
        {
            try
            {
                var t = await _svc.UpdateAsync(id, req);
                return t == null ? NotFound() : Ok(t);
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
    }
}
