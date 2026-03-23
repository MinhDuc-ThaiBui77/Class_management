namespace ClassManager.API.Models.DTOs
{
    // ── Teacher ──────────────────────────────────────────────────────

    public record TeacherRequest(string FullName, string Phone, string Email, string Subject, int? UserId, string Notes = "");

    public record TeacherResponse(int Id, string FullName, string Phone, string Email, string Subject, string Notes, int ClassCount, int? UserId, string? UserEmail);

    // ── Class ────────────────────────────────────────────────────────

    public record ClassRequest(string Name, string Subject, int? TeacherId, string Notes = "");

    public record ClassResponse(int Id, string Name, string Subject, string Notes, int StudentCount, int? TeacherId, string? TeacherName);

    public record ClassStudentItem(int StudentId, string FullName, string Phone, DateTime EnrolledDate);

    public record EnrollRequest(int StudentId);

    // ── Auth ─────────────────────────────────────────────────────────

    public record LoginRequest(string Email, string Password);

    public record RegisterRequest(string FullName, string Email, string Password, string Role = "teacher");

    public record AuthResponse(string Token, string FullName, string Email, string Role);

    // ── Student ──────────────────────────────────────────────────────

    public record StudentRequest(
        string FullName,
        string Phone,
        string ParentPhone,
        DateTime? DateOfBirth,
        DateTime? EnrolledDate,
        string Notes
    );

    public record StudentResponse(
        int Id,
        string FullName,
        string Phone,
        string ParentPhone,
        DateTime? DateOfBirth,
        DateTime EnrolledDate,
        string Notes,
        bool IsActive
    );

    // ── Session ──────────────────────────────────────────────────────

    public record SessionRequest(int ClassId, DateTime SessionDate, string Topic, string Notes = "");

    public record SessionResponse(int Id, int ClassId, string ClassName, string Subject, DateTime SessionDate, string Topic, string Notes);

    // ── Attendance ───────────────────────────────────────────────────

    public record AttendanceItem(int StudentId, string StudentName, string Status);

    public record SaveAttendanceRequest(int SessionId, List<AttendanceItem> Records);

    // ── User (Account Management) ─────────────────────────────────────

    public record UserResponse(int Id, string FullName, string Email, string Role, bool IsActive, DateTime CreatedAt, int? TeacherId, string? TeacherName);

    // ExistingTeacherId: link tới Teacher profile đã có
    // TeacherSubject: tạo Teacher profile mới inline (dùng khi chưa có profile)
    public record CreateUserRequest(string FullName, string Email, string Password, string Role = "teacher", int? ExistingTeacherId = null, string? TeacherSubject = null, string? TeacherPhone = null);

    public record UpdateUserRequest(string FullName, string Role, int? ExistingTeacherId = null, string? TeacherSubject = null, string? TeacherPhone = null);

    public record ResetPasswordRequest(string NewPassword);

    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    public record AvailableTeacherItem(int Id, string FullName, string Subject);

    // ── Payment ──────────────────────────────────────────────────────

    public record PaymentRequest(int StudentId, decimal Amount, int MonthOf, int YearOf, string Notes = "");

    public record PaymentStatusItem(
        int StudentId,
        string StudentName,
        bool IsPaid,
        decimal Amount,
        DateTime? PaidDate,
        string Notes
    );

    public record MonthlyPaymentResponse(
        int Month,
        int Year,
        List<PaymentStatusItem> Students,
        decimal TotalCollected,
        int UnpaidCount
    );
}
