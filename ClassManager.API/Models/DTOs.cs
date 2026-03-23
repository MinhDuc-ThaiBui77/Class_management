namespace ClassManager.API.Models.DTOs
{
    // ── Teacher ──────────────────────────────────────────────────────

    public record TeacherRequest(string FullName, string Phone, string Email, string Subject, int? UserId, string Notes = "", decimal? SalaryPerSession = null);

    public record TeacherResponse(int Id, string FullName, string Phone, string Email, string Subject, string Notes, int ClassCount, int? UserId, string? UserEmail, decimal? SalaryPerSession = null);

    // ── Class ────────────────────────────────────────────────────────

    public record ClassRequest(string Name, string Subject, int? TeacherId, string Notes = "", int? TotalSessions = null, decimal? TuitionFee = null, DateTime? StartDate = null);

    public record ClassResponse(int Id, string Name, string Subject, string Notes, int StudentCount, int? TeacherId, string? TeacherName, int? TotalSessions = null, decimal? TuitionFee = null, DateTime? StartDate = null);

    public record ClassStudentItem(int StudentId, string FullName, string Address, DateTime EnrolledDate);

    public record EnrollRequest(int StudentId);

    // ── Auth ─────────────────────────────────────────────────────────

    public record LoginRequest(string Email, string Password);

    public record RegisterRequest(string FullName, string Email, string Password, string Role = "teacher");

    public record AuthResponse(string Token, string FullName, string Email, string Role);

    // ── Student ──────────────────────────────────────────────────────

    public record StudentClassInfo(string ClassName, string Subject, string? TeacherName);

    public record StudentRequest(
        string FullName,
        string Address,
        string ParentPhone,
        DateTime? DateOfBirth,
        DateTime? EnrolledDate,
        string Notes
    );

    public record StudentResponse(
        int Id,
        string FullName,
        string Address,
        string ParentPhone,
        DateTime? DateOfBirth,
        DateTime EnrolledDate,
        string Notes,
        bool IsActive,
        int ClassCount,
        List<StudentClassInfo> Classes
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

    // ── Import ───────────────────────────────────────────────────────

    public record ImportRowError(int Row, string Message);

    public record ImportResult(int Created, int Skipped, List<ImportRowError> Errors);

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

    // ── Expense ─────────────────────────────────────────────────────

    public record ExpenseRequest(string Title, decimal Amount, DateTime ExpenseDate, bool IsRecurring = false, string Notes = "");

    public record ExpenseResponse(int Id, string Title, decimal Amount, DateTime ExpenseDate, bool IsRecurring, string Notes);

    // ── Report ──────────────────────────────────────────────────────

    public record TeacherCostItem(int TeacherId, string TeacherName, string Subject, int SessionCount, decimal SalaryPerSession, decimal Total);

    public record ReportSummary(
        decimal Revenue,
        decimal ExpectedRevenue,
        decimal TeacherCost,
        decimal ExpenseCost,
        decimal TotalCost,
        decimal Profit,
        int TotalStudents,
        int PaidStudents,
        decimal CollectionRate,
        List<TeacherCostItem> TeacherBreakdown,
        List<ExpenseResponse> ExpenseBreakdown
    );

    public record MonthlyReportItem(int Month, int Year, decimal Revenue, decimal TotalCost, decimal Profit);
}
