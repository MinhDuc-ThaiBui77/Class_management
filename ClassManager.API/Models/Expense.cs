namespace ClassManager.API.Models
{
    public class Expense
    {
        public int Id { get; set; }
        public string Title { get; set; } = "";
        public decimal Amount { get; set; }
        public DateTime ExpenseDate { get; set; }
        public bool IsRecurring { get; set; }
        public string Notes { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
