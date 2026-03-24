namespace ClassManager.API.Models
{
    public class Payment
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public int ClassId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaidDate { get; set; } = DateTime.UtcNow;
        public string Notes { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public Student Student { get; set; } = null!;
        public Class Class { get; set; } = null!;
    }
}
