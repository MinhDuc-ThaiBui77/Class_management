using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class UserService
    {
        private readonly AppDbContext _db;

        public UserService(AppDbContext db) => _db = db;

        // ── Danh sách tài khoản (kèm teacher info nếu có) ─────────────
        public async Task<List<UserResponse>> GetAllAsync(string callerRole)
        {
            var query = _db.Users.AsQueryable();
            // Non-owner không thấy owner accounts
            if (callerRole != Roles.Owner)
                query = query.Where(u => u.Role != Roles.Owner);

            return await query
                .GroupJoin(_db.Teachers, u => u.Id, t => t.UserId, (u, ts) => new { u, t = ts.FirstOrDefault() })
                .OrderBy(x => x.u.FullName)
                .Select(x => new UserResponse(
                    x.u.Id, x.u.FullName, x.u.Email, x.u.Role, x.u.IsActive, x.u.CreatedAt,
                    x.t != null ? (int?)x.t.Id : null,
                    x.t != null ? x.t.FullName : null))
                .ToListAsync();
        }

        // ── Helper: lấy teacherId của user hiện tại (dùng để filter) ──
        public async Task<int?> GetTeacherIdByUserIdAsync(int userId) =>
            await _db.Teachers
                .Where(t => t.UserId == userId)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync();

        // ── Danh sách Teacher chưa được link với user nào ──────────────
        public async Task<List<AvailableTeacherItem>> GetAvailableTeachersAsync(int? excludeLinkedToUserId = null)
        {
            return await _db.Teachers
                .Where(t => t.IsActive && (t.UserId == null || t.UserId == excludeLinkedToUserId))
                .OrderBy(t => t.FullName)
                .Select(t => new AvailableTeacherItem(t.Id, t.FullName, t.Subject))
                .ToListAsync();
        }

        // ── Tạo tài khoản mới ─────────────────────────────────────────
        public async Task<(UserResponse? User, string? Error)> CreateAsync(CreateUserRequest req, string callerRole)
        {
            if (string.IsNullOrWhiteSpace(req.FullName))
                return (null, "Họ tên không được để trống.");
            if (string.IsNullOrWhiteSpace(req.Email))
                return (null, "Email không được để trống.");
            if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
                return (null, "Mật khẩu phải có ít nhất 6 ký tự.");
            if (!Roles.Assignable.Contains(req.Role))
                return (null, $"Role không hợp lệ. Chọn: {string.Join(", ", Roles.Assignable)}.");
            // Chỉ có thể tạo role thấp hơn mình
            if (!Roles.IsAbove(callerRole, req.Role))
                return (null, "Không có quyền tạo tài khoản với role này.");
            if (await _db.Users.AnyAsync(u => u.Email == req.Email.Trim().ToLower()))
                return (null, "Email đã được sử dụng.");

            // Validate teacher linking
            if (req.Role == Roles.Teacher && req.ExistingTeacherId == null && string.IsNullOrWhiteSpace(req.TeacherSubject))
                return (null, "Tài khoản giáo viên phải được gán hồ sơ giáo viên.");

            if (req.ExistingTeacherId.HasValue)
            {
                var teacher = await _db.Teachers.FindAsync(req.ExistingTeacherId.Value);
                if (teacher == null || !teacher.IsActive)
                    return (null, "Hồ sơ giáo viên không tồn tại.");
                if (teacher.UserId != null)
                    return (null, "Hồ sơ giáo viên này đã được link với tài khoản khác.");
            }

            if (!string.IsNullOrWhiteSpace(req.TeacherSubject) && !SubjectList.Valid.Contains(req.TeacherSubject))
                return (null, $"Môn học không hợp lệ. Chọn: {string.Join(", ", SubjectList.Valid)}");

            var user = new User
            {
                FullName     = req.FullName.Trim(),
                Email        = req.Email.Trim().ToLower(),
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                Role         = req.Role,
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();

            int? teacherId = null;
            string? teacherName = null;

            if (req.Role == Roles.Teacher)
            {
                if (req.ExistingTeacherId.HasValue)
                {
                    // Link teacher profile đã có
                    var teacher = await _db.Teachers.FindAsync(req.ExistingTeacherId.Value)!;
                    teacher!.UserId = user.Id;
                    teacherId = teacher.Id;
                    teacherName = teacher.FullName;
                }
                else if (!string.IsNullOrWhiteSpace(req.TeacherSubject))
                {
                    // Tạo teacher profile mới inline
                    var teacher = new Teacher
                    {
                        FullName = req.FullName.Trim(),
                        Subject  = req.TeacherSubject,
                        Email    = req.Email.Trim().ToLower(),
                        Phone    = PhoneHelper.Normalize(req.TeacherPhone),
                        UserId   = user.Id,
                    };
                    _db.Teachers.Add(teacher);
                    teacherName = teacher.FullName;
                }
                await _db.SaveChangesAsync();
                teacherId = teacherId ?? await _db.Teachers.Where(t => t.UserId == user.Id).Select(t => (int?)t.Id).FirstOrDefaultAsync();
            }

            return (new UserResponse(user.Id, user.FullName, user.Email, user.Role, user.IsActive, user.CreatedAt, teacherId, teacherName), null);
        }

        // ── Cập nhật tên, role, teacher link ─────────────────────────
        public async Task<(UserResponse? User, string? Error)> UpdateAsync(int id, UpdateUserRequest req, int requesterId, string callerRole)
        {
            if (string.IsNullOrWhiteSpace(req.FullName))
                return (null, "Họ tên không được để trống.");
            if (!Roles.Assignable.Contains(req.Role))
                return (null, $"Role không hợp lệ. Chọn: {string.Join(", ", Roles.Assignable)}.");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return (null, null);

            // Không thể sửa user có role >= mình (trừ owner)
            if (!Roles.IsAbove(callerRole, user.Role) && callerRole != Roles.Owner)
                return (null, "Không có quyền sửa tài khoản này.");
            // Không thể gán role >= mình
            if (!Roles.IsAbove(callerRole, req.Role) && callerRole != Roles.Owner)
                return (null, "Không có quyền gán role này.");
            if (user.Id == requesterId && req.Role != user.Role)
                return (null, "Không thể tự thay đổi role của chính mình.");

            if (req.Role == Roles.Teacher && req.ExistingTeacherId == null && string.IsNullOrWhiteSpace(req.TeacherSubject))
            {
                // Chỉ validate nếu user chưa có teacher profile
                var existingLink = await _db.Teachers.AnyAsync(t => t.UserId == id);
                if (!existingLink)
                    return (null, "Tài khoản giáo viên phải được gán hồ sơ giáo viên.");
            }

            if (req.ExistingTeacherId.HasValue)
            {
                var teacher = await _db.Teachers.FindAsync(req.ExistingTeacherId.Value);
                if (teacher == null || !teacher.IsActive)
                    return (null, "Hồ sơ giáo viên không tồn tại.");
                if (teacher.UserId != null && teacher.UserId != id)
                    return (null, "Hồ sơ giáo viên này đã được link với tài khoản khác.");
            }

            if (!string.IsNullOrWhiteSpace(req.TeacherSubject) && !SubjectList.Valid.Contains(req.TeacherSubject))
                return (null, $"Môn học không hợp lệ. Chọn: {string.Join(", ", SubjectList.Valid)}");

            // Nếu đổi từ teacher → role khác: unlink teacher profile cũ
            if (user.Role == Roles.Teacher && req.Role != Roles.Teacher)
            {
                var oldTeacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == id);
                if (oldTeacher != null) oldTeacher.UserId = null;
            }

            user.FullName = req.FullName.Trim();
            user.Role     = req.Role;
            await _db.SaveChangesAsync();

            // Xử lý link teacher mới
            if (req.Role == Roles.Teacher)
            {
                if (req.ExistingTeacherId.HasValue)
                {
                    // Unlink teacher cũ nếu có
                    var oldTeacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == id && t.Id != req.ExistingTeacherId.Value);
                    if (oldTeacher != null) oldTeacher.UserId = null;
                    // Link teacher mới
                    var newTeacher = await _db.Teachers.FindAsync(req.ExistingTeacherId.Value)!;
                    newTeacher!.UserId = user.Id;
                }
                else if (!string.IsNullOrWhiteSpace(req.TeacherSubject))
                {
                    var oldTeacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == id);
                    if (oldTeacher == null)
                    {
                        _db.Teachers.Add(new Teacher
                        {
                            FullName = user.FullName,
                            Subject  = req.TeacherSubject,
                            Email    = user.Email,
                            Phone    = PhoneHelper.Normalize(req.TeacherPhone),
                            UserId   = user.Id,
                        });
                    }
                    else
                    {
                        oldTeacher.Subject = req.TeacherSubject;
                        if (!string.IsNullOrWhiteSpace(req.TeacherPhone))
                            oldTeacher.Phone = req.TeacherPhone.Trim();
                    }
                }
                await _db.SaveChangesAsync();
            }

            var teacherId   = await _db.Teachers.Where(t => t.UserId == user.Id).Select(t => (int?)t.Id).FirstOrDefaultAsync();
            var teacherName = await _db.Teachers.Where(t => t.UserId == user.Id).Select(t => t.FullName).FirstOrDefaultAsync();
            return (new UserResponse(user.Id, user.FullName, user.Email, user.Role, user.IsActive, user.CreatedAt, teacherId, teacherName), null);
        }

        // ── Reset mật khẩu ────────────────────────────────────────────
        public async Task<(bool Ok, string? Error)> ResetPasswordAsync(int id, ResetPasswordRequest req, int requesterId, string callerRole)
        {
            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
                return (false, "Mật khẩu phải có ít nhất 6 ký tự.");
            var user = await _db.Users.FindAsync(id);
            if (user == null) return (false, null);
            if (!Roles.IsAbove(callerRole, user.Role) && callerRole != Roles.Owner)
                return (false, "Không có quyền reset mật khẩu tài khoản này.");
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            await _db.SaveChangesAsync();
            return (true, null);
        }

        // ── Tự đổi mật khẩu ──────────────────────────────────────────
        public async Task<(bool Ok, string? Error)> ChangePasswordAsync(int userId, ChangePasswordRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
                return (false, "Mật khẩu mới phải có ít nhất 6 ký tự.");
            var user = await _db.Users.FindAsync(userId);
            if (user == null) return (false, null);
            if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
                return (false, "Mật khẩu hiện tại không đúng.");
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
            await _db.SaveChangesAsync();
            return (true, null);
        }

        // ── Xóa tài khoản vĩnh viễn ──────────────────────────────────
        public async Task<(bool Ok, string? Error)> DeleteAsync(int id, int requesterId, string callerRole)
        {
            if (id == requesterId)
                return (false, "Không thể xóa tài khoản của chính mình.");

            var user = await _db.Users.FindAsync(id);
            if (user == null) return (false, null);

            if (!Roles.IsAbove(callerRole, user.Role) && callerRole != Roles.Owner)
                return (false, "Không có quyền xóa tài khoản này.");

            // Deactivate teacher profile nếu có
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == id);
            if (teacher != null)
            {
                teacher.UserId   = null;
                teacher.IsActive = false;
            }

            _db.Users.Remove(user);
            await _db.SaveChangesAsync();
            return (true, null);
        }

        // ── Toggle active/inactive ────────────────────────────────────
        public async Task<(UserResponse? User, string? Error)> ToggleActiveAsync(int id, int requesterId, string callerRole)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null) return (null, null);
            if (user.Id == requesterId)
                return (null, "Không thể tự vô hiệu hóa tài khoản của chính mình.");
            if (!Roles.IsAbove(callerRole, user.Role) && callerRole != Roles.Owner)
                return (null, "Không có quyền thay đổi trạng thái tài khoản này.");
            user.IsActive = !user.IsActive;

            // Sync trạng thái teacher theo account
            var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.UserId == user.Id);
            if (teacher != null) teacher.IsActive = user.IsActive;

            await _db.SaveChangesAsync();
            var teacherId   = await _db.Teachers.Where(t => t.UserId == user.Id).Select(t => (int?)t.Id).FirstOrDefaultAsync();
            var teacherName = await _db.Teachers.Where(t => t.UserId == user.Id).Select(t => t.FullName).FirstOrDefaultAsync();
            return (new UserResponse(user.Id, user.FullName, user.Email, user.Role, user.IsActive, user.CreatedAt, teacherId, teacherName), null);
        }
    }
}
