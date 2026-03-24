using ClassManager.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ClassManager.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Teacher> Teachers => Set<Teacher>();
        public DbSet<Student> Students => Set<Student>();
        public DbSet<Class> Classes => Set<Class>();
        public DbSet<StudentClass> StudentClasses => Set<StudentClass>();
        public DbSet<Session> Sessions => Set<Session>();
        public DbSet<Attendance> Attendances => Set<Attendance>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<Expense> Expenses => Set<Expense>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Teacher: UserId là unique (1 user chỉ link 1 teacher)
            modelBuilder.Entity<Teacher>()
                .HasIndex(t => t.UserId)
                .IsUnique()
                .HasFilter("\"UserId\" IS NOT NULL");

            // StudentClass: composite PK
            modelBuilder.Entity<StudentClass>()
                .HasKey(sc => new { sc.StudentId, sc.ClassId });

            // Attendance: mỗi học sinh chỉ có 1 record cho mỗi buổi
            modelBuilder.Entity<Attendance>()
                .HasIndex(a => new { a.StudentId, a.SessionId })
                .IsUnique();

            // Payment: mỗi học sinh chỉ đóng 1 lần cho mỗi lớp
            modelBuilder.Entity<Payment>()
                .HasIndex(p => new { p.StudentId, p.ClassId })
                .IsUnique();

            // Decimal precision cho Amount
            modelBuilder.Entity<Payment>()
                .Property(p => p.Amount)
                .HasPrecision(12, 2);

            modelBuilder.Entity<Expense>()
                .Property(e => e.Amount)
                .HasPrecision(12, 2);

            modelBuilder.Entity<Class>()
                .Property(c => c.TeacherSalaryPerSession)
                .HasPrecision(12, 2);
        }
    }
}
