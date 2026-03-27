namespace ClassManager.API.Models
{
    public class PaymentLog
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        public string Action { get; set; } = ""; // "thu" | "hủy_thu"
        public int StudentId { get; set; }
        public string StudentName { get; set; } = "";
        public int ClassId { get; set; }
        public string ClassName { get; set; } = "";
        public decimal Amount { get; set; }
        public string Reason { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
