namespace ClassManager.API.Models
{
    /// <summary>
    /// Role hierarchy: owner (4) > admin (3) > manager (2) > teacher (1)
    /// </summary>
    public static class Roles
    {
        public const string Teacher = "teacher";
        public const string Manager = "manager";
        public const string Admin   = "admin";
        public const string Owner   = "owner";

        // Roles that can be assigned via UI (owner is seed-only)
        public static readonly string[] Assignable = [Teacher, Manager, Admin];
        public static readonly string[] All = [Teacher, Manager, Admin, Owner];

        private static int Level(string role) => role switch
        {
            Owner   => 4,
            Admin   => 3,
            Manager => 2,
            Teacher => 1,
            _       => 0,
        };

        /// <summary>caller's role >= required role in hierarchy</summary>
        public static bool IsAtLeast(string callerRole, string requiredRole)
            => Level(callerRole) >= Level(requiredRole);

        /// <summary>caller's role > target's role (can manage target)</summary>
        public static bool IsAbove(string callerRole, string targetRole)
            => Level(callerRole) > Level(targetRole);

        public static bool IsValid(string role) => All.Contains(role);

        // Authorize policy strings for [Authorize(Roles = "...")]
        public const string ManagerUp = "manager,admin,owner";
        public const string AdminUp   = "admin,owner";
    }

    public class User
    {
        public int Id { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string PasswordHash { get; set; } = "";
        public string Role { get; set; } = Roles.Teacher;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public bool MustChangePassword { get; set; } = true;
    }
}
