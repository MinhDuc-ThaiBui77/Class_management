using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public static class RoomList
    {
        public static readonly string[] Valid = ["Phòng 1", "Phòng 2", "Phòng 3", "Phòng 4", "Phòng 5"];
    }

    public static class TimeSlotList
    {
        public static readonly string[] Valid = ["Sáng", "Chiều", "Tối"];
    }

    public class AttendanceService
    {
        private readonly AppDbContext _db;
        public AttendanceService(AppDbContext db) => _db = db;

        private static SessionResponse MapSession(Session s) => new(
            s.Id, s.ClassId, s.Class.Name, s.Class.Subject,
            s.Class.Teacher?.FullName,
            s.SessionDate, s.Room, s.TimeSlot, s.Topic, s.Notes);

        public async Task<List<SessionResponse>> GetSessionsByWeekAsync(DateTime weekStart, int? teacherId = null)
        {
            var start = DateTime.SpecifyKind(weekStart.Date, DateTimeKind.Utc);
            var end = start.AddDays(7);

            var query = _db.Sessions
                .Include(s => s.Class).ThenInclude(c => c.Teacher)
                .Where(s => s.SessionDate >= start && s.SessionDate < end);

            if (teacherId.HasValue)
                query = query.Where(s => s.Class.TeacherId == teacherId.Value);

            return await query
                .OrderBy(s => s.SessionDate).ThenBy(s => s.Room).ThenBy(s => s.TimeSlot)
                .Select(s => MapSession(s))
                .ToListAsync();
        }

        public async Task<List<SessionResponse>> GetAllSessionsAsync(int? teacherId = null)
        {
            var query = _db.Sessions.Include(s => s.Class).ThenInclude(c => c.Teacher).AsQueryable();
            if (teacherId.HasValue)
                query = query.Where(s => s.Class.TeacherId == teacherId.Value);
            return await query
                .OrderByDescending(s => s.SessionDate)
                .Select(s => MapSession(s))
                .ToListAsync();
        }

        public async Task<SessionResponse> CreateSessionAsync(SessionRequest req, int? callerTeacherId = null)
        {
            // Validate
            if (!RoomList.Valid.Contains(req.Room))
                throw new InvalidOperationException($"Phòng không hợp lệ. Chọn: {string.Join(", ", RoomList.Valid)}");
            if (!TimeSlotList.Valid.Contains(req.TimeSlot))
                throw new InvalidOperationException($"Ca học không hợp lệ. Chọn: {string.Join(", ", TimeSlotList.Valid)}");

            var cls = await _db.Classes.Include(c => c.Teacher).FirstOrDefaultAsync(c => c.Id == req.ClassId)
                ?? throw new InvalidOperationException("Lớp học không tồn tại.");

            if (callerTeacherId.HasValue && cls.TeacherId != callerTeacherId.Value)
                throw new InvalidOperationException("Bạn chỉ có thể tạo buổi học cho lớp của mình.");

            // Conflict check
            var sessionDate = DateTime.SpecifyKind(req.SessionDate.Date, DateTimeKind.Utc);
            var conflict = await _db.Sessions
                .Include(s => s.Class).ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(s =>
                    s.SessionDate == sessionDate &&
                    s.Room == req.Room &&
                    s.TimeSlot == req.TimeSlot);

            if (conflict != null)
            {
                var conflictTeacher = conflict.Class.Teacher?.FullName ?? "Chưa có GV";
                throw new InvalidOperationException(
                    $"{req.Room} ca {req.TimeSlot} ngày {sessionDate:dd/MM/yyyy} đã có lịch: " +
                    $"{conflict.Class.Name} {conflict.Class.Subject} - {conflictTeacher}");
            }

            var session = new Session
            {
                ClassId     = req.ClassId,
                SessionDate = sessionDate,
                Room        = req.Room,
                TimeSlot    = req.TimeSlot,
                Topic       = req.Topic.Trim(),
                Notes       = req.Notes.Trim(),
            };
            _db.Sessions.Add(session);
            await _db.SaveChangesAsync();

            return new SessionResponse(session.Id, session.ClassId, cls.Name, cls.Subject,
                cls.Teacher?.FullName, session.SessionDate, session.Room, session.TimeSlot, session.Topic, session.Notes);
        }

        public async Task<bool> DeleteSessionAsync(int id)
        {
            var session = await _db.Sessions.FindAsync(id);
            if (session == null) return false;
            _db.Sessions.Remove(session);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<SessionResponse?> UpdateTopicAsync(int sessionId, string topic, int? callerTeacherId = null)
        {
            var session = await _db.Sessions.Include(s => s.Class).ThenInclude(c => c.Teacher)
                .FirstOrDefaultAsync(s => s.Id == sessionId);
            if (session == null) return null;

            if (callerTeacherId.HasValue && session.Class.TeacherId != callerTeacherId.Value)
                throw new InvalidOperationException("Bạn chỉ có thể sửa nội dung buổi dạy của lớp mình.");

            session.Topic = topic.Trim();
            await _db.SaveChangesAsync();
            return MapSession(session);
        }

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
