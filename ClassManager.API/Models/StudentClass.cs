namespace ClassManager.API.Models
{
    public class StudentClass
    {
        public int StudentId { get; set; }
        public Student Student { get; set; } = null!;

        public int ClassId { get; set; }
        public Class Class { get; set; } = null!;

        public DateTime EnrolledDate { get; set; } = DateTime.UtcNow;
    }
}
