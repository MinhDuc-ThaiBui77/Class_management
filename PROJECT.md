# ClassManagerWeb — Tài liệu thiết kế dự án

> Mục đích: Giúp AI nắm nhanh toàn bộ tình trạng dự án để tiếp tục phát triển.
> Cập nhật lần cuối: 2026-03-23

---

## 1. Tổng quan

Ứng dụng quản lý lớp học tư nhân (gia sư / trung tâm nhỏ). Gồm:
- Quản lý học sinh, giáo viên, lớp học
- Điểm danh theo buổi học (gắn với lớp)
- Ghi nhận học phí theo tháng/học sinh

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 |
| **Backend** | ASP.NET Core (.NET 10) — Web API |
| **Database** | PostgreSQL (Supabase cloud) |
| **ORM** | Entity Framework Core + Npgsql |
| **Auth** | JWT Bearer (HS256, 7 ngày) |
| **HTTP Client** | Axios (baseURL: `/api`, proxy qua Vite → `localhost:5227`) |

---

## 3. Cấu trúc thư mục

```
ClassManagerWeb/
├── ClassManager.API/          ← Backend ASP.NET Core
│   ├── Controllers/           ← API endpoints
│   ├── Services/              ← Business logic
│   ├── Models/
│   │   ├── *.cs               ← Entity models
│   │   └── DTOs.cs            ← Request/Response records
│   ├── Data/
│   │   └── AppDbContext.cs    ← EF Core context
│   ├── Migrations/            ← EF migrations
│   └── Program.cs             ← App bootstrap + DI
│
└── class-manager-fe/          ← Frontend React
    └── src/
        ├── App.tsx            ← Routes + PrivateRoute
        ├── hooks/useAuth.tsx  ← AuthContext + flushSync fix
        ├── api/index.ts       ← Axios instance + tất cả API calls
        ├── components/
        │   └── Layout.tsx     ← Sidebar navigation
        └── pages/
            ├── LoginPage.tsx
            ├── StudentsPage.tsx
            ├── TeachersPage.tsx
            ├── ClassesPage.tsx
            ├── AttendancePage.tsx
            └── PaymentsPage.tsx
```

---

## 4. Database Schema

### Entities & Relationships

```
Users               ← Tài khoản đăng nhập (admin | teacher)
  id, fullName, email, passwordHash (BCrypt), role, isActive, createdAt

Teachers            ← Hồ sơ giáo viên (tách biệt với User)
  id, fullName, phone, email, subject, notes, isActive, createdAt
  userId (nullable FK → Users)   ← Link tới account đăng nhập

Students            ← Học sinh
  id, fullName, phone, parentPhone, dateOfBirth, enrolledDate, notes, isActive, createdAt

Classes             ← Lớp học (VD: 9A - Toán)
  id, name, subject, notes, createdAt
  teacherId (nullable FK → Teachers)

StudentClass        ← Join table: học sinh ↔ lớp (many-to-many)
  studentId (FK), classId (FK), enrolledDate
  PK: (studentId, classId)

Sessions            ← Buổi học (gắn với 1 lớp)
  id, classId (FK → Classes), sessionDate, topic, notes, createdAt

Attendances         ← Điểm danh từng học sinh mỗi buổi
  id, studentId (FK), sessionId (FK), status (Present|Absent|Excused)
  UNIQUE INDEX: (studentId, sessionId)

Payments            ← Học phí theo tháng/học sinh
  id, studentId (FK), amount (decimal 12,2), paidDate, monthOf, yearOf, notes, createdAt
  UNIQUE INDEX: (studentId, monthOf, yearOf)
```

### Quan hệ quan trọng
- **1 lớp có 1 giáo viên** (nullable)
- **1 học sinh học nhiều lớp** (qua StudentClass)
- **1 buổi học gắn với 1 lớp** → điểm danh chỉ lấy HS trong lớp đó
- **1 giáo viên có thể link 1 user account** (UNIQUE, nullable)
- Học phí tính **theo học sinh**, không theo lớp

---

## 5. API Endpoints

### Auth — `/api/auth` (không cần token)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/login` | Đăng nhập → trả `{ token, fullName, email, role }` |
| POST | `/register` | Tạo tài khoản mới `{ fullName, email, password, role }` |

### Teachers — `/api/teachers` (cần token)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Danh sách GV active |
| GET | `/subjects` | Danh sách môn cố định: `["Toán","Văn","Tiếng Anh"]` |
| GET | `/available-users` | Users chưa được link với GV nào |
| GET | `/{id}` | Chi tiết GV |
| POST | `/` | Tạo GV mới |
| PUT | `/{id}` | Cập nhật GV |
| DELETE | `/{id}` | Soft-deactivate (admin only) |

### Students — `/api/students` (cần token)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Danh sách HS active, có `?search=` |
| GET | `/{id}` | Chi tiết HS |
| POST | `/` | Tạo HS mới |
| PUT | `/{id}` | Cập nhật HS |
| DELETE | `/{id}` | Soft-delete (admin only) |

### Classes — `/api/classes` (cần token)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | Danh sách lớp (kèm studentCount, teacherName) |
| GET | `/{id}` | Chi tiết lớp |
| POST | `/` | Tạo lớp `{ name, subject, teacherId?, notes }` |
| PUT | `/{id}` | Cập nhật lớp (có thể assign/thay GV) |
| DELETE | `/{id}` | Xóa lớp (admin only) |
| GET | `/{id}/students` | DS học sinh trong lớp |
| POST | `/{id}/students` | Enroll HS vào lớp `{ studentId }` |
| DELETE | `/{id}/students/{studentId}` | Unenroll HS |

### Attendance — `/api/attendance` (cần token)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/sessions` | Tất cả buổi học (kèm className, subject) |
| POST | `/sessions` | Tạo buổi `{ classId, sessionDate, topic, notes }` |
| DELETE | `/sessions/{id}` | Xóa buổi học |
| GET | `/sessions/{sessionId}` | DS HS của lớp + trạng thái điểm danh |
| POST | `/` | Lưu điểm danh `{ sessionId, records: [{studentId, studentName, status}] }` |

### Payments — `/api/payments` (cần token)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/?month=&year=` | Trạng thái học phí tháng/năm (tất cả HS active) |
| POST | `/` | Ghi nhận thanh toán `{ studentId, amount, monthOf, yearOf, notes }` |
| DELETE | `/{id}` | Xóa bản ghi thanh toán |

---

## 6. Frontend — Pages & Routes

| Route | Component | Chức năng |
|---|---|---|
| `/login` | LoginPage | Đăng nhập |
| `/students` | StudentsPage | CRUD học sinh, search |
| `/teachers` | TeachersPage | CRUD giáo viên, link user account |
| `/classes` | ClassesPage | CRUD lớp, assign GV, enroll/unenroll HS |
| `/attendance` | AttendancePage | Tạo buổi học (chọn lớp), điểm danh |
| `/payments` | PaymentsPage | Ghi nhận học phí theo tháng |

### Auth Flow
- `AuthProvider` bọc ngoài `BrowserRouter` trong App.tsx
- `login()` dùng `flushSync` để force React flush state trước khi navigate
- `PrivateRoute` check `token` từ context, redirect `/login` nếu null
- JWT lưu trong `localStorage` key `"token"` và `"user"`
- Axios request interceptor tự gắn `Authorization: Bearer <token>`
- Axios response interceptor: nếu 401 → clear localStorage + `window.location.href = '/login'`

### Subject List (cố định, có thể mở rộng)
Định nghĩa ở backend: `TeacherService.SubjectList.Valid = ["Toán", "Văn", "Tiếng Anh"]`
Frontend fetch từ `GET /api/teachers/subjects`.

---

## 7. Các vấn đề đã fix

| # | Vấn đề | Fix |
|---|---|---|
| 1 | Login xong bị redirect về `/login` | `flushSync` trong `login()` của `useAuth.tsx` — React 19 batching race condition |
| 2 | JWT 401 sau khi restart server | `appsettings.json` đổi key sau khi server start → `IConfiguration` auto-reload nhưng JwtBearer dùng key cũ — Fix: restart backend |
| 3 | `Cannot write DateTime Unspecified to PostgreSQL` | Dùng `DateTime.SpecifyKind(dt, DateTimeKind.Utc)` trong `StudentService` và `AttendanceService` |

---

## 8. Cấu hình môi trường

### Backend (`appsettings.json`)
```json
{
  "ConnectionStrings": {
    "Default": "Host=...supabase...;Port=5432;Database=postgres;..."
  },
  "Jwt": {
    "Key": "AhdNrySNmklvDCM/amz6PRnotcx5WSx4GQ8djHCiImY=",
    "Issuer": "ClassManagerAPI",
    "Audience": "ClassManagerApp"
  },
  "AllowedOrigins": "http://localhost:5173,https://..."
}
```
> ⚠️ Nếu đổi `Jwt:Key` → phải restart backend ngay lập tức.

### Frontend (`vite.config.ts`)
```ts
server: { proxy: { '/api': 'http://localhost:5227' } }
```

### Chạy local
```bash
# Backend (từ ClassManager.API/)
dotnet run          # chạy ở port 5227

# Frontend (từ class-manager-fe/)
npm run dev         # chạy ở port 5173 (hoặc 5174, 5175 nếu bận)
```

---

## 9. Tính năng đang thiếu / TODO

| Tính năng | Mô tả | Ưu tiên |
|---|---|---|
| **Quản lý tài khoản (UI)** | Hiện chỉ có API `/register`. Cần trang admin để tạo/disable account | Cao |
| **Xem lớp của GV** | GV login chỉ thấy lớp mình dạy | Cao |
| **Báo cáo** | Tổng hợp học phí theo lớp, tỷ lệ điểm danh | Trung bình |
| **Học phí theo lớp** | Hiện thu theo HS, chưa phân theo từng lớp | Thấp |
| **Thêm môn học** | Subject list hiện hardcode — cần UI để mở rộng | Thấp |

---

## 10. Migrations đã có

| Migration | Nội dung |
|---|---|
| `InitialCreate` | Users, Students, Sessions, Attendances, Payments |
| `AddClasses` | Classes, StudentClasses, thêm ClassId vào Sessions |
| `AddTeachers` | Teachers (có UserId FK), thêm TeacherId vào Classes |
