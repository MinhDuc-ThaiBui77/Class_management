namespace ClassManager.API.Models
{
    public class Teacher
    {
        public int Id { get; set; }
        public string FullName { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Email { get; set; } = "";
        public string Subject { get; set; } = "";   // Toán | Văn | Tiếng Anh
        public string Notes { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? UserId { get; set; }        // Link tới account đăng nhập (nullable)
        public User? User { get; set; }

        public ICollection<Class> Classes { get; set; } = new List<Class>();
    }
}
