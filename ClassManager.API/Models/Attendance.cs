namespace ClassManager.API.Models
{
    public class Attendance
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public int SessionId { get; set; }
        public string Status { get; set; } = "Present"; // Present | Absent | Excused
        public string Reason { get; set; } = "";

        // Navigation properties
        public Student Student { get; set; } = null!;
        public Session Session { get; set; } = null!;
    }
}
