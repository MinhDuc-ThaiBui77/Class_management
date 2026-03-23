namespace ClassManager.API.Models
{
    public class Student
    {
        public int Id { get; set; }
        public string FullName { get; set; } = "";
        public string Address { get; set; } = "";
        public string ParentPhone { get; set; } = "";
        public DateTime? DateOfBirth { get; set; }
        public DateTime EnrolledDate { get; set; } = DateTime.UtcNow;
        public string Notes { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties (EF Core dùng để JOIN)
        public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
        public ICollection<Payment> Payments { get; set; } = new List<Payment>();
        public ICollection<StudentClass> StudentClasses { get; set; } = new List<StudentClass>();
    }
}
