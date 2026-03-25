using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class StudentService
    {
        private readonly AppDbContext _db;
        public StudentService(AppDbContext db) => _db = db;

        public async Task<List<StudentResponse>> GetAllAsync(string? search = null, int? teacherId = null)
        {
            var query = _db.Students.Where(s => s.IsActive);

            if (teacherId.HasValue)
            {
                var studentIds = await _db.StudentClasses
                    .Where(sc => sc.Class.TeacherId == teacherId.Value)
                    .Select(sc => sc.StudentId)
                    .Distinct()
                    .ToListAsync();
                query = query.Where(s => studentIds.Contains(s.Id));
            }

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(s =>
                    s.FullName.Contains(search) ||
                    s.Address.Contains(search) ||
                    s.ParentPhone.Contains(search));

            return await query
                .OrderBy(s => s.FullName)
                .Select(s => new StudentResponse(
                    s.Id, s.FullName, s.Address, s.ParentPhone,
                    s.DateOfBirth, s.EnrolledDate, s.Notes, s.IsActive,
                    s.StudentClasses.Count,
                    s.StudentClasses.Select(sc => new StudentClassInfo(
                        sc.Class.Name,
                        sc.Class.Subject,
                        sc.Class.Teacher != null ? sc.Class.Teacher.FullName : null
                    )).ToList()
                ))
                .ToListAsync();
        }

        public async Task<StudentResponse?> GetByIdAsync(int id)
        {
            var s = await _db.Students
                .Include(x => x.StudentClasses)
                    .ThenInclude(sc => sc.Class)
                        .ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(x => x.Id == id);
            return s == null ? null : ToResponse(s);
        }

        public async Task<StudentResponse> CreateAsync(StudentRequest req)
        {
            Validate(req);
            var student = new Student
            {
                FullName     = req.FullName.Trim(),
                Address      = req.Address.Trim(),
                ParentPhone  = PhoneHelper.Normalize(req.ParentPhone),
                DateOfBirth  = req.DateOfBirth.HasValue ? DateTime.SpecifyKind(req.DateOfBirth.Value, DateTimeKind.Utc) : null,
                EnrolledDate = req.EnrolledDate.HasValue ? DateTime.SpecifyKind(req.EnrolledDate.Value, DateTimeKind.Utc) : DateTime.UtcNow,
                Notes        = req.Notes.Trim(),
            };
            _db.Students.Add(student);
            await _db.SaveChangesAsync();
            return ToResponse(student);
        }

        public async Task<StudentResponse?> UpdateAsync(int id, StudentRequest req)
        {
            Validate(req);
            var student = await _db.Students.FindAsync(id);
            if (student == null) return null;

            student.FullName    = req.FullName.Trim();
            student.Address     = req.Address.Trim();
            student.ParentPhone = PhoneHelper.Normalize(req.ParentPhone);
            student.DateOfBirth = req.DateOfBirth.HasValue ? DateTime.SpecifyKind(req.DateOfBirth.Value, DateTimeKind.Utc) : null;
            student.Notes       = req.Notes.Trim();

            await _db.SaveChangesAsync();
            return ToResponse(student);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var student = await _db.Students.FindAsync(id);
            if (student == null) return false;
            student.IsActive = false; // Soft delete
            await _db.SaveChangesAsync();
            return true;
        }

        /// <summary>Kiểm tra HS có thuộc lớp của teacher không</summary>
        public async Task<bool> IsStudentOfTeacherAsync(int studentId, int? teacherId)
        {
            if (teacherId == null) return false;
            return await _db.StudentClasses
                .AnyAsync(sc => sc.StudentId == studentId && sc.Class.TeacherId == teacherId.Value);
        }

        private static void Validate(StudentRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.FullName))
                throw new InvalidOperationException("Họ tên không được để trống.");
            if (req.FullName.Trim().Length < 2)
                throw new InvalidOperationException("Họ tên quá ngắn.");
        }

        private static StudentResponse ToResponse(Student s) => new(
            s.Id, s.FullName, s.Address, s.ParentPhone,
            s.DateOfBirth, s.EnrolledDate, s.Notes, s.IsActive,
            s.StudentClasses.Count,
            s.StudentClasses.Select(sc => new StudentClassInfo(
                sc.Class.Name,
                sc.Class.Subject,
                sc.Class.Teacher?.FullName
            )).ToList()
        );
    }
}
