namespace ClassManager.API.Models
{
    public class Payment
    {
        public int Id { get; set; }
        public int StudentId { get; set; }
        public decimal Amount { get; set; }
        public DateTime PaidDate { get; set; } = DateTime.UtcNow;
        public int MonthOf { get; set; }
        public int YearOf { get; set; }
        public string Notes { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation property
        public Student Student { get; set; } = null!;
    }
}
