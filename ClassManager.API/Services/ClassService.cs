using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class ClassService
    {
        private readonly AppDbContext _db;
        public ClassService(AppDbContext db) => _db = db;

        public async Task<List<ClassResponse>> GetAllAsync(int? teacherId = null)
        {
            var query = _db.Classes.Include(c => c.Teacher).AsQueryable();
            if (teacherId.HasValue)
                query = query.Where(c => c.TeacherId == teacherId.Value);
            return await query
                .OrderBy(c => c.Name).ThenBy(c => c.Subject)
                .Select(c => new ClassResponse(
                    c.Id, c.Name, c.Subject, c.Notes,
                    c.StudentClasses.Count(sc => sc.Student.IsActive),
                    c.TeacherId, c.Teacher != null ? c.Teacher.FullName : null,
                    c.TotalSessions, c.TuitionFee, c.StartDate))
                .ToListAsync();
        }

        public async Task<ClassResponse?> GetByIdAsync(int id)
        {
            var c = await _db.Classes
                .Include(c => c.StudentClasses)
                .Include(c => c.Teacher)
                .FirstOrDefaultAsync(c => c.Id == id);
            return c == null ? null : new ClassResponse(c.Id, c.Name, c.Subject, c.Notes, c.StudentClasses.Count(sc => sc.Student.IsActive), c.TeacherId, c.Teacher?.FullName, c.TotalSessions, c.TuitionFee, c.StartDate);
        }

        public async Task<ClassResponse> CreateAsync(ClassRequest req)
        {
            await ValidateAsync(req);
            var cls = new Class
            {
                Name          = req.Name.Trim(),
                Subject       = req.Subject.Trim(),
                Notes         = req.Notes.Trim(),
                TeacherId     = req.TeacherId,
                TotalSessions = req.TotalSessions,
                TuitionFee    = req.TuitionFee,
                StartDate     = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value, DateTimeKind.Utc) : null,
            };
            _db.Classes.Add(cls);
            await _db.SaveChangesAsync();
            var teacherName = req.TeacherId.HasValue
                ? (await _db.Teachers.FindAsync(req.TeacherId.Value))?.FullName
                : null;
            return new ClassResponse(cls.Id, cls.Name, cls.Subject, cls.Notes, 0, cls.TeacherId, teacherName, cls.TotalSessions, cls.TuitionFee, cls.StartDate);
        }

        public async Task<ClassResponse?> UpdateAsync(int id, ClassRequest req)
        {
            await ValidateAsync(req);
            var cls = await _db.Classes.Include(c => c.StudentClasses).Include(c => c.Teacher).FirstOrDefaultAsync(c => c.Id == id);
            if (cls == null) return null;
            cls.Name          = req.Name.Trim();
            cls.Subject       = req.Subject.Trim();
            cls.Notes         = req.Notes.Trim();
            cls.TeacherId     = req.TeacherId;
            cls.TotalSessions = req.TotalSessions ?? cls.TotalSessions;
            cls.TuitionFee    = req.TuitionFee ?? cls.TuitionFee;
            cls.StartDate     = req.StartDate.HasValue ? DateTime.SpecifyKind(req.StartDate.Value, DateTimeKind.Utc) : cls.StartDate;
            await _db.SaveChangesAsync();
            var teacherName = req.TeacherId.HasValue
                ? (await _db.Teachers.FindAsync(req.TeacherId.Value))?.FullName
                : null;
            return new ClassResponse(cls.Id, cls.Name, cls.Subject, cls.Notes, cls.StudentClasses.Count, cls.TeacherId, teacherName, cls.TotalSessions, cls.TuitionFee, cls.StartDate);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var cls = await _db.Classes.FindAsync(id);
            if (cls == null) return false;
            _db.Classes.Remove(cls);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<List<ClassStudentItem>> GetStudentsAsync(int classId)
        {
            return await _db.StudentClasses
                .Where(sc => sc.ClassId == classId && sc.Student.IsActive)
                .OrderBy(sc => sc.Student.FullName)
                .Select(sc => new ClassStudentItem(
                    sc.StudentId, sc.Student.FullName, sc.Student.Address, sc.EnrolledDate))
                .ToListAsync();
        }

        public async Task<bool> EnrollAsync(int classId, int studentId)
        {
            var exists = await _db.StudentClasses.AnyAsync(sc => sc.ClassId == classId && sc.StudentId == studentId);
            if (exists) return false;
            _db.StudentClasses.Add(new StudentClass
            {
                ClassId     = classId,
                StudentId   = studentId,
                EnrolledDate = DateTime.UtcNow,
            });
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UnenrollAsync(int classId, int studentId)
        {
            var sc = await _db.StudentClasses.FindAsync(studentId, classId);
            if (sc == null) return false;
            _db.StudentClasses.Remove(sc);
            await _db.SaveChangesAsync();
            return true;
        }

        private async Task ValidateAsync(ClassRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Name))
                throw new InvalidOperationException("Tên lớp không được để trống.");
            if (string.IsNullOrWhiteSpace(req.Subject))
                throw new InvalidOperationException("Môn học không được để trống.");
            if (!SubjectList.Valid.Contains(req.Subject))
                throw new InvalidOperationException($"Môn học không hợp lệ.");
            if (req.TeacherId.HasValue)
            {
                var teacher = await _db.Teachers.FindAsync(req.TeacherId.Value);
                if (teacher == null || !teacher.IsActive)
                    throw new InvalidOperationException("Giáo viên không tồn tại.");
                if (teacher.Subject != req.Subject)
                    throw new InvalidOperationException(
                        $"Giáo viên \"{teacher.FullName}\" dạy môn {teacher.Subject}, không thể đứng lớp môn {req.Subject}.");
            }
        }
    }
}
