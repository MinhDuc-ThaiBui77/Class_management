using ClassManager.API.Data;
using ClassManager.API.Models;
using ClassManager.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Services
{
    public static class RoomList
    {
        public static readonly string[] Valid = ["Phòng 1", "Phòng 2", "Phòng 3A", "Phòng 3B", "Phòng 5"];
    }

    public static class TimeSlotList
    {
        public static readonly string[] Valid = [
            "Ca 1 (7h15-9h15)",
            "Ca 2 (9h20-11h20)",
            "Ca 3 (14h15-16h15)",
            "Ca 4 (16h30-18h30)",
            "Ca 5 (19h-21h)"
        ];
    }

    public class AttendanceService
    {
        private readonly AppDbContext _db;
        public AttendanceService(AppDbContext db) => _db = db;

        // Tính session index cho mỗi session trong 1 lớp (theo thứ tự ngày)
        private async Task<Dictionary<int, int>> GetSessionIndexMapAsync(IEnumerable<int> classIds)
        {
            var map = new Dictionary<int, int>(); // sessionId → index (1-based)
            foreach (var cid in classIds.Distinct())
            {
                var sessions = await _db.Sessions
                    .Where(s => s.ClassId == cid)
                    .OrderBy(s => s.SessionDate).ThenBy(s => s.TimeSlot)
                    .Select(s => s.Id)
                    .ToListAsync();
                for (int i = 0; i < sessions.Count; i++)
                    map[sessions[i]] = i + 1;
            }
            return map;
        }

        private SessionResponse MapSession(Session s, int sessionIndex) => new(
            s.Id, s.ClassId, s.Class.Name, s.Class.Subject,
            s.Class.Teacher?.FullName,
            s.SessionDate, s.Room, s.TimeSlot, s.Topic, s.Notes, s.DutyTeacher,
            sessionIndex, s.Class.TotalSessions);

        public async Task<List<SessionResponse>> GetSessionsByWeekAsync(DateTime weekStart, int? teacherId = null)
        {
            var start = DateTime.SpecifyKind(weekStart.Date, DateTimeKind.Utc);
            var end = start.AddDays(7);

            var query = _db.Sessions
                .Include(s => s.Class).ThenInclude(c => c.Teacher)
                .Where(s => s.SessionDate >= start && s.SessionDate < end);

            if (teacherId.HasValue)
                query = query.Where(s => s.Class.TeacherId == teacherId.Value);

            var sessions = await query
                .OrderBy(s => s.SessionDate).ThenBy(s => s.Room).ThenBy(s => s.TimeSlot)
                .ToListAsync();

            var indexMap = await GetSessionIndexMapAsync(sessions.Select(s => s.ClassId));
            return sessions.Select(s => MapSession(s, indexMap.GetValueOrDefault(s.Id, 0))).ToList();
        }

        public async Task<List<SessionResponse>> GetAllSessionsAsync(int? teacherId = null)
        {
            var query = _db.Sessions.Include(s => s.Class).ThenInclude(c => c.Teacher).AsQueryable();
            if (teacherId.HasValue)
                query = query.Where(s => s.Class.TeacherId == teacherId.Value);
            var sessions = await query.OrderByDescending(s => s.SessionDate).ToListAsync();

            var indexMap = await GetSessionIndexMapAsync(sessions.Select(s => s.ClassId));
            return sessions.Select(s => MapSession(s, indexMap.GetValueOrDefault(s.Id, 0))).ToList();
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

            // Session limit check
            if (cls.TotalSessions.HasValue)
            {
                var currentCount = await _db.Sessions.CountAsync(s => s.ClassId == req.ClassId);
                if (currentCount >= cls.TotalSessions.Value)
                    throw new InvalidOperationException(
                        $"Lớp {cls.Name} đã đạt tối đa {cls.TotalSessions.Value} buổi. Không thể tạo thêm.");
            }

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
                ClassId      = req.ClassId,
                SessionDate  = sessionDate,
                Room         = req.Room,
                TimeSlot     = req.TimeSlot,
                Topic        = req.Topic.Trim(),
                Notes        = req.Notes.Trim(),
                DutyTeacher  = req.DutyTeacher.Trim(),
            };
            _db.Sessions.Add(session);
            await _db.SaveChangesAsync();

            var newIndex = await _db.Sessions.CountAsync(s => s.ClassId == req.ClassId);
            return new SessionResponse(session.Id, session.ClassId, cls.Name, cls.Subject,
                cls.Teacher?.FullName, session.SessionDate, session.Room, session.TimeSlot, session.Topic, session.Notes, session.DutyTeacher,
                newIndex, cls.TotalSessions);
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
            var indexMap = await GetSessionIndexMapAsync(new[] { session.ClassId });
            return MapSession(session, indexMap.GetValueOrDefault(session.Id, 0));
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
