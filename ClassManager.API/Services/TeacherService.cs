using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public static class SubjectList
    {
        public static readonly string[] Valid = [
            "Toán", "Văn", "Tiếng Anh", "Lý", "Hoá",
            "Luyện viết TH 1", "Luyện viết TH 2", "Luyện viết TH 3", "Luyện viết TH 4", "Luyện viết TH 5"
        ];
    }

    public static class PhoneHelper
    {
        /// <summary>
        /// Chuẩn hóa SĐT: bắt đầu bằng 0, đúng 10 số.
        /// Nếu 9 số → thêm 0 đầu. Nếu rỗng → trả rỗng. Nếu sai → throw.
        /// </summary>
        public static string Normalize(string? phone)
        {
            if (string.IsNullOrWhiteSpace(phone)) return "";
            var digits = new string(phone.Trim().Where(char.IsDigit).ToArray());
            if (digits.Length == 9 && digits[0] != '0')
                digits = "0" + digits;
            if (digits.Length != 10 || digits[0] != '0')
                throw new InvalidOperationException($"SĐT \"{phone.Trim()}\" không hợp lệ. SĐT phải có 10 số và bắt đầu bằng 0.");
            return digits;
        }
    }

    public class TeacherService
    {
        private readonly AppDbContext _db;
        public TeacherService(AppDbContext db) => _db = db;

        public async Task<List<TeacherResponse>> GetAllAsync(int? userId = null)
        {
            var query = _db.Teachers.Where(t => t.IsActive).Include(t => t.User).AsQueryable();
            if (userId.HasValue)
                query = query.Where(t => t.UserId == userId.Value);
            return await query
                .OrderBy(t => t.FullName)
                .Select(t => new TeacherResponse(
                    t.Id, t.FullName, t.Phone, t.Email, t.Subject, t.Notes,
                    t.Classes.Count, t.UserId, t.User != null ? t.User.Email : null))
                .ToListAsync();
        }

        public async Task<TeacherResponse?> GetByIdAsync(int id)
        {
            var t = await _db.Teachers.Include(t => t.Classes).Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id);
            return t == null ? null : new TeacherResponse(t.Id, t.FullName, t.Phone, t.Email, t.Subject, t.Notes, t.Classes.Count, t.UserId, t.User?.Email);
        }

        // Danh sách Users chưa được link với bất kỳ teacher nào (để chọn trong combobox)
        public async Task<List<object>> GetAvailableUsersAsync()
        {
            var linkedUserIds = await _db.Teachers.Where(t => t.UserId != null).Select(t => t.UserId).ToListAsync();
            return await _db.Users
                .Where(u => u.IsActive && !linkedUserIds.Contains(u.Id))
                .OrderBy(u => u.FullName)
                .Select(u => (object)new { u.Id, u.FullName, u.Email, u.Role })
                .ToListAsync();
        }

        public async Task<TeacherResponse> CreateAsync(TeacherRequest req)
        {
            Validate(req);
            await ValidateUserId(req.UserId, null);
            var teacher = new Teacher
            {
                FullName = req.FullName.Trim(),
                Phone    = PhoneHelper.Normalize(req.Phone),
                Email    = req.Email.Trim(),
                Subject  = req.Subject,
                Notes  = req.Notes.Trim(),
                UserId = req.UserId,
            };
            _db.Teachers.Add(teacher);
            await _db.SaveChangesAsync();
            var userEmail = req.UserId.HasValue ? (await _db.Users.FindAsync(req.UserId.Value))?.Email : null;
            return new TeacherResponse(teacher.Id, teacher.FullName, teacher.Phone, teacher.Email, teacher.Subject, teacher.Notes, 0, teacher.UserId, userEmail);
        }

        public async Task<TeacherResponse?> UpdateAsync(int id, TeacherRequest req)
        {
            Validate(req);
            var teacher = await _db.Teachers.Include(t => t.Classes).Include(t => t.User).FirstOrDefaultAsync(t => t.Id == id);
            if (teacher == null) return null;
            await ValidateUserId(req.UserId, id);
            teacher.FullName = req.FullName.Trim();
            teacher.Phone    = PhoneHelper.Normalize(req.Phone);
            teacher.Email    = req.Email.Trim();
            teacher.Subject  = req.Subject;
            teacher.Notes  = req.Notes.Trim();
            teacher.UserId = req.UserId;
            await _db.SaveChangesAsync();
            var userEmail = req.UserId.HasValue ? (await _db.Users.FindAsync(req.UserId.Value))?.Email : null;
            return new TeacherResponse(teacher.Id, teacher.FullName, teacher.Phone, teacher.Email, teacher.Subject, teacher.Notes, teacher.Classes.Count, teacher.UserId, userEmail);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var teacher = await _db.Teachers.Include(t => t.Classes).FirstOrDefaultAsync(t => t.Id == id);
            if (teacher == null) return false;

            // Gỡ giáo viên khỏi các lớp đang dạy
            foreach (var cls in teacher.Classes)
                cls.TeacherId = null;

            // Xóa User account liên kết (nếu có)
            if (teacher.UserId.HasValue)
            {
                var user = await _db.Users.FindAsync(teacher.UserId.Value);
                if (user != null)
                    _db.Users.Remove(user);
            }

            _db.Teachers.Remove(teacher);
            await _db.SaveChangesAsync();
            return true;
        }

        private static void Validate(TeacherRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.FullName))
                throw new InvalidOperationException("Họ tên không được để trống.");
            if (!SubjectList.Valid.Contains(req.Subject))
                throw new InvalidOperationException($"Môn học không hợp lệ. Chọn một trong: {string.Join(", ", SubjectList.Valid)}");
        }

        private async Task ValidateUserId(int? userId, int? excludeTeacherId)
        {
            if (userId == null) return;
            var query = _db.Teachers.Where(t => t.UserId == userId);
            if (excludeTeacherId.HasValue) query = query.Where(t => t.Id != excludeTeacherId.Value);
            if (await query.AnyAsync())
                throw new InvalidOperationException("Tài khoản này đã được link với giáo viên khác.");
        }
    }
}
