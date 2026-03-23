namespace ClassManager.API.Models
{
    public class Class
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";       // 9A, 9B, 8C...
        public string Subject { get; set; } = "";    // Toán, Văn, Anh...
        public string Notes { get; set; } = "";
        public int? TotalSessions { get; set; }
        public decimal? TuitionFee { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? TeacherId { get; set; }
        public Teacher? Teacher { get; set; }

        public ICollection<StudentClass> StudentClasses { get; set; } = new List<StudentClass>();
        public ICollection<Session> Sessions { get; set; } = new List<Session>();
    }
}
