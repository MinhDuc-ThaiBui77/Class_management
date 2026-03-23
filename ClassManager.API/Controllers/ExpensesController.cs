using ClassManager.API.Models.DTOs;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClassManager.API.Controllers
{
    [ApiController]
    [Route("api/expenses")]
    [Authorize(Roles = "admin")]
    public class ExpensesController : ControllerBase
    {
        private readonly ExpenseService _svc;
        public ExpensesController(ExpenseService svc) => _svc = svc;

        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] int? month, [FromQuery] int? year)
            => Ok(await _svc.GetAllAsync(month, year));

        [HttpPost]
        public async Task<IActionResult> Create(ExpenseRequest req)
        {
            try { return Ok(await _svc.CreateAsync(req)); }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, ExpenseRequest req)
        {
            try
            {
                var result = await _svc.UpdateAsync(id, req);
                return result == null ? NotFound() : Ok(result);
            }
            catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
            => await _svc.DeleteAsync(id) ? NoContent() : NotFound();
    }
}
