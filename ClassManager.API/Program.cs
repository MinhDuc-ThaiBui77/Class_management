using System.Text;
using ClassManager.API.Data;
using ClassManager.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default"))
       .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

// ── Services (Dependency Injection) ──────────────────────────────
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ImportService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<TeacherService>();
builder.Services.AddScoped<StudentService>();
builder.Services.AddScoped<ClassService>();
builder.Services.AddScoped<AttendanceService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<ExpenseService>();
builder.Services.AddScoped<ReportService>();

// ── JWT Authentication ────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();

// ── CORS: cho phép React frontend gọi API ────────────────────────
builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(policy =>
        policy.WithOrigins(
                builder.Configuration["AllowedOrigins"]?.Split(',') ?? ["http://localhost:5173"])
              .AllowAnyHeader()
              .AllowAnyMethod()));

var app = builder.Build();

// ── Auto migrate + seed admin mặc định ───────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Schema patch: idempotent — chạy an toàn dù đã hoặc chưa áp dụng
    db.Database.ExecuteSqlRaw("""
        DO $$ BEGIN
            -- Đổi tên Phone → Address trong Students (nếu chưa đổi)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Students' AND column_name = 'Phone'
            ) THEN
                ALTER TABLE "Students" RENAME COLUMN "Phone" TO "Address";
            END IF;
            -- Thêm StartDate vào Classes (nếu chưa có)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Classes' AND column_name = 'StartDate'
            ) THEN
                ALTER TABLE "Classes" ADD COLUMN "StartDate" timestamp with time zone;
            END IF;
            -- Thêm TotalSessions vào Classes (nếu chưa có)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Classes' AND column_name = 'TotalSessions'
            ) THEN
                ALTER TABLE "Classes" ADD COLUMN "TotalSessions" integer;
            END IF;
            -- Thêm TuitionFee vào Classes (nếu chưa có)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Classes' AND column_name = 'TuitionFee'
            ) THEN
                ALTER TABLE "Classes" ADD COLUMN "TuitionFee" numeric(12,2);
            END IF;
            -- Chuyển SalaryPerSession từ Teachers sang Classes (TeacherSalaryPerSession)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Classes' AND column_name = 'TeacherSalaryPerSession'
            ) THEN
                ALTER TABLE "Classes" ADD COLUMN "TeacherSalaryPerSession" numeric(12,2);
                -- Copy salary từ Teacher sang các lớp của GV đó
                UPDATE "Classes" c SET "TeacherSalaryPerSession" = t."SalaryPerSession"
                FROM "Teachers" t WHERE c."TeacherId" = t."Id" AND t."SalaryPerSession" IS NOT NULL;
            END IF;
            -- Drop SalaryPerSession cũ từ Teachers (nếu còn)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Teachers' AND column_name = 'SalaryPerSession'
            ) THEN
                ALTER TABLE "Teachers" DROP COLUMN "SalaryPerSession";
            END IF;
            -- Tạo bảng Expenses (nếu chưa có)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'Expenses'
            ) THEN
                CREATE TABLE "Expenses" (
                    "Id" SERIAL PRIMARY KEY,
                    "Title" text NOT NULL DEFAULT '',
                    "Amount" numeric(12,2) NOT NULL DEFAULT 0,
                    "ExpenseDate" timestamp with time zone NOT NULL,
                    "IsRecurring" boolean NOT NULL DEFAULT false,
                    "Notes" text NOT NULL DEFAULT '',
                    "CreatedAt" timestamp with time zone NOT NULL DEFAULT now()
                );
            END IF;

            -- Xóa payment rác (ClassId=0, từ data cũ trước khi migrate)
            DELETE FROM "Payments" WHERE "ClassId" = 0;

            -- Thêm Reason vào Attendances (nếu chưa có)
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Attendances' AND column_name = 'Reason'
            ) THEN
                ALTER TABLE "Attendances" ADD COLUMN "Reason" text NOT NULL DEFAULT '';
            END IF;

            -- Chuyển Payment từ theo tháng sang theo lớp
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'Payments' AND column_name = 'MonthOf'
            ) THEN
                -- Xóa payment cũ (model cũ không tương thích)
                DELETE FROM "Payments";
                -- Drop index cũ
                DROP INDEX IF EXISTS "IX_Payments_StudentId_MonthOf_YearOf";
                -- Drop cột cũ
                ALTER TABLE "Payments" DROP COLUMN "MonthOf";
                ALTER TABLE "Payments" DROP COLUMN "YearOf";
                -- Thêm ClassId
                ALTER TABLE "Payments" ADD COLUMN "ClassId" integer NOT NULL DEFAULT 0;
                ALTER TABLE "Payments" ADD CONSTRAINT "FK_Payments_Classes_ClassId"
                    FOREIGN KEY ("ClassId") REFERENCES "Classes"("Id") ON DELETE CASCADE;
                CREATE UNIQUE INDEX "IX_Payments_StudentId_ClassId"
                    ON "Payments" ("StudentId", "ClassId");
            END IF;
        END $$;
        """);

    // Đảm bảo tài khoản admin mặc định luôn tồn tại
    if (!db.Users.Any(u => u.Email == "admin@classmanager.local"))
    {
        db.Users.Add(new ClassManager.API.Models.User
        {
            FullName     = "Administrator",
            Email        = "admin@classmanager.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role         = "admin",
        });
        db.SaveChanges();
        Console.WriteLine("✓ Admin mặc định đã được tạo: admin@classmanager.local / Admin@123");
    }
}

app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    ctx.Response.StatusCode  = 500;
    ctx.Response.ContentType = "application/json";
    var feature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
    var message = feature?.Error?.Message ?? "Đã xảy ra lỗi không xác định.";
    await ctx.Response.WriteAsJsonAsync(new { message });
}));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
