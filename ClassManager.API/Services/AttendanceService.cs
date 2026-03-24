using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public class AttendanceService
    {
        private readonly AppDbContext _db;
        public AttendanceService(AppDbContext db) => _db = db;

        public async Task<List<SessionResponse>> GetAllSessionsAsync(int? teacherId = null)
        {
            var query = _db.Sessions.Include(s => s.Class).AsQueryable();
            if (teacherId.HasValue)
                query = query.Where(s => s.Class.TeacherId == teacherId.Value);
            return await query
                .OrderByDescending(s => s.SessionDate)
                .Select(s => new SessionResponse(s.Id, s.ClassId, s.Class.Name, s.Class.Subject, s.SessionDate, s.Topic, s.Notes))
                .ToListAsync();
        }

        public async Task<SessionResponse> CreateSessionAsync(SessionRequest req, int? callerTeacherId = null)
        {
            if (string.IsNullOrWhiteSpace(req.Topic))
                throw new InvalidOperationException("Chủ đề buổi học không được để trống.");

            var cls = await _db.Classes.FindAsync(req.ClassId)
                ?? throw new InvalidOperationException("Lớp học không tồn tại.");

            if (callerTeacherId.HasValue && cls.TeacherId != callerTeacherId.Value)
                throw new InvalidOperationException("Bạn chỉ có thể tạo buổi học cho lớp của mình.");

            var session = new Session
            {
                ClassId     = req.ClassId,
                SessionDate = DateTime.SpecifyKind(req.SessionDate, DateTimeKind.Utc),
                Topic       = req.Topic.Trim(),
                Notes       = req.Notes.Trim(),
            };
            _db.Sessions.Add(session);
            await _db.SaveChangesAsync();
            return new SessionResponse(session.Id, session.ClassId, cls.Name, cls.Subject, session.SessionDate, session.Topic, session.Notes);
        }

        public async Task<bool> DeleteSessionAsync(int id)
        {
            var session = await _db.Sessions.FindAsync(id);
            if (session == null) return false;
            _db.Sessions.Remove(session);
            await _db.SaveChangesAsync();
            return true;
        }

        // Lấy danh sách học sinh trong lớp của buổi học + trạng thái điểm danh
        public async Task<List<AttendanceItem>> GetAttendanceForSessionAsync(int sessionId)
        {
            var session = await _db.Sessions.FindAsync(sessionId)
                ?? throw new InvalidOperationException("Buổi học không tồn tại.");

            var students = await _db.StudentClasses
                .Where(sc => sc.ClassId == session.ClassId)
                .Select(sc => sc.Student)
                .Where(s => s.IsActive)
                .OrderBy(s => s.FullName)
                .ToListAsync();

            var existing = await _db.Attendances
                .Where(a => a.SessionId == sessionId)
                .ToDictionaryAsync(a => a.StudentId, a => new { a.Status, a.Reason });

            return students.Select(s =>
            {
                var has = existing.TryGetValue(s.Id, out var att);
                return new AttendanceItem(s.Id, s.FullName, has ? att.Status : "Present", has ? att.Reason : "");
            }).ToList();
        }

        // Lưu toàn bộ điểm danh 1 buổi (xóa cũ, insert mới)
        public async Task SaveAttendanceAsync(SaveAttendanceRequest req)
        {
            var existing = await _db.Attendances
                .Where(a => a.SessionId == req.SessionId)
                .ToListAsync();
            _db.Attendances.RemoveRange(existing);

            var newRecords = req.Records.Select(r => new Attendance
            {
                StudentId = r.StudentId,
                SessionId = req.SessionId,
                Status    = r.Status,
                Reason    = r.Reason,
            });
            _db.Attendances.AddRange(newRecords);
            await _db.SaveChangesAsync();
        }
    }
}
