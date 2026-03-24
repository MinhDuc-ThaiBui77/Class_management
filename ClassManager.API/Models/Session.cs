namespace ClassManager.API.Models
{
    public class Session
    {
        public int Id { get; set; }
        public DateTime SessionDate { get; set; }
        public string Room { get; set; } = "";         // "Phòng 1" | "Phòng 2" | "Phòng 3" | "Phòng 4"
        public string TimeSlot { get; set; } = "";     // "Sáng" | "Chiều" | "Tối"
        public string Topic { get; set; } = "";
        public string Notes { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int ClassId { get; set; }
        public Class Class { get; set; } = null!;

        public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
    }
}
