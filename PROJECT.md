# ClassManagerWeb — Tài liệu thiết kế dự án

> Mục đích: Giúp AI nắm nhanh toàn bộ tình trạng dự án để tiếp tục phát triển.
> Cập nhật lần cuối: 2026-03-25

---

## 1. Tổng quan

Ứng dụng quản lý trung tâm dạy học tư nhân. Gồm:
- Quản lý học sinh, giáo viên, lớp học (nhóm theo khối, card grid)
- Điểm danh theo buổi + lịch dạy calendar (phòng × ca × tuần)
- Học phí theo lớp (1 HS đóng 1 lần/khóa, không theo tháng)
- Lương GV tự động = Số HS × 35,000₫ × 75% / buổi
- Quản lý tài khoản (admin/teacher)
- Chi phí cố định + phát sinh
- Báo cáo tài chính (tháng/quý/năm) + biểu đồ + Excel export
- Export Excel cho tất cả tabs
- Import học sinh từ Excel
- Theme: Đỏ #DE2228 + Vàng #F6AB10

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite 8 + Tailwind CSS v4 |
| **Backend** | ASP.NET Core (.NET 10) — Web API |
| **Database** | PostgreSQL (Supabase cloud) |
| **ORM** | Entity Framework Core + Npgsql |
| **Auth** | JWT Bearer (HS256, 7 ngày) |
| **HTTP** | Axios |
| **Charts** | Recharts |
| **Excel** | XLSX (FE), ClosedXML (BE) |

---

## 3. Database Schema

```
Users: id, fullName, email, passwordHash(BCrypt), role("admin"|"teacher"), isActive, createdAt

Teachers: id, fullName, phone, email, subject, notes, isActive, createdAt, userId(FK→Users, UNIQUE nullable)

Students: id, fullName, address, parentPhone, dateOfBirth?, enrolledDate, notes, isActive(soft delete), createdAt

Classes: id, name, subject, notes, totalSessions(int?), tuitionFee(decimal?), startDate?, createdAt, teacherId(FK→Teachers nullable)

StudentClass: studentId(FK), classId(FK), enrolledDate — PK(studentId,classId)

Sessions: id, classId(FK), sessionDate, room("Phòng 1-5"), timeSlot("Sáng"|"Chiều"|"Tối"), topic, notes, createdAt
  UNIQUE: (sessionDate, room, timeSlot) WHERE room!='' AND timeSlot!=''

Attendances: id, studentId(FK), sessionId(FK), status("Present"|"Absent"|"Excused"), reason, UNIQUE(studentId,sessionId)

Payments: id, studentId(FK), classId(FK), amount(12,2), paidDate, notes, createdAt, UNIQUE(studentId,classId)

Expenses: id, title, amount(12,2), expenseDate, isRecurring, notes, createdAt
```

### Quan hệ quan trọng
- 1 lớp có 1 GV (nullable) — validate GV dạy đúng môn
- 1 HS học nhiều lớp (StudentClass), 1 enrollment = 1 payment
- Session gắn với lớp + phòng + ca, conflict check khi tạo
- Lương GV tính tự động: Số HS × 35k × 75% per session (không lưu DB)
- Student soft delete, payment records giữ nguyên (doanh thu không bị ảnh hưởng)
- Tên lớp unique (check khi tạo/sửa)
- SĐT: 10 số, bắt đầu bằng 0, auto-prefix 9→10 số

---

## 4. API Endpoints

### Auth `/api/auth`
- POST `/login` — đăng nhập
- POST `/register` — admin tạo tài khoản

### Users `/api/users` (admin)
- GET `/` | POST `/` | PUT `/{id}` | DELETE `/{id}`
- POST `/{id}/reset-password` | PATCH `/{id}/toggle` | PUT `/me/password`

### Teachers `/api/teachers`
- GET `/` | GET `/{id}` | POST `/` | PUT `/{id}` | DELETE `/{id}`
- GET `/subjects` | GET `/available-users` | GET `/export`

### Students `/api/students`
- GET `/?search=` | GET `/{id}` | POST `/` | PUT `/{id}` | DELETE `/{id}`
- GET `/export` | GET `/import-template` | POST `/import`

### Classes `/api/classes`
- GET `/` | GET `/{id}` | POST `/` | PUT `/{id}` | DELETE `/{id}`
- GET `/{id}/students` | POST `/{id}/students` | DELETE `/{id}/students/{sid}`
- POST `/{id}/students/import` | GET `/{id}/export` | GET `/{id}/export-attendance`

### Attendance `/api/attendance`
- GET `/sessions?week=` | POST `/sessions` | DELETE `/sessions/{id}`
- PUT `/sessions/{id}/topic` — GV tự cập nhật nội dung buổi dạy
- GET `/sessions/{id}` | POST `/` — lưu điểm danh

### Payments `/api/payments`
- GET `/` | POST `/` | DELETE `/{id}` | GET `/export?classId=`

### Expenses `/api/expenses` (admin)
- GET `/?month=&year=` | POST `/` | PUT `/{id}` | DELETE `/{id}`

### Reports `/api/reports` (admin)
- GET `/summary?period=&year=&month=&quarter=`
- GET `/chart?year=` | GET `/export?...`

---

## 5. Frontend Pages

| Route | Chức năng |
|---|---|
| `/login` | 2-column login (brand panel + form) |
| `/students` | Stat cards, table + pagination, search, sort, bulk delete, import/export Excel |
| `/teachers` | Card grid, avatar, subject badge, export Excel |
| `/classes` | Tabs theo khối + card grid, panel quản lý HS, export DS + điểm danh |
| `/attendance` | 2 sub-tabs: Điểm danh (danh sách ngày + mini calendar) + Lịch dạy (calendar tuần + mini calendar) |
| `/payments` | Filter (tên/lớp/trạng thái/ngày), info popover, export Excel (tất cả hoặc theo lớp) |
| `/reports` | 4 stat cards, bar chart, tab lương GV + chi phí, export Excel |
| `/accounts` | CRUD user, link teacher, reset/đổi PW, toggle active |

### Design System
- **Theme**: Đỏ #DE2228 (primary) + Vàng #F6AB10 (accent)
- **Sidebar**: Collapsible (hover expand, click navigate → collapse), gradient đỏ đậm, SVG icons
- **Shared components**: Toast, ConfirmDialog, LoadingSkeleton, EmptyState, StatCard, Badge
- **Animations**: fadeIn, slideIn, shake, shimmer skeleton, toast in/out

### Phân quyền
- Admin: tất cả CRUD, 7 mục sidebar
- Teacher: 5 mục, chỉ xem lớp mình, sửa nội dung buổi dạy

---

## 6. Nghiệp vụ quan trọng

### Học phí
- Gắn theo lớp (StudentId, ClassId), 1 lần/khóa
- Số tiền mặc định = TuitionFee, admin có thể sửa
- HS chưa có lớp: không thể đóng
- Revenue tính theo PaidDate, KHÔNG lọc IsActive (tiền đã thu là đã thu)

### Lương giáo viên
- Tự động: Số HS active × 35,000₫ × 75% per session
- Không lưu DB, tính real-time trong ReportService
- 1 GV dạy nhiều lớp → mỗi lớp tính riêng

### Điểm danh & Lịch dạy
- 5 phòng × 3 ca (Sáng/Chiều/Tối)
- Conflict check: cùng ngày + phòng + ca → lỗi cụ thể
- Session limit: không vượt TotalSessions
- Session index: hiện "buổi X/Y"
- Auto-save khi click trạng thái, ô lý do khi Vắng/Có phép
- Mini calendar highlight ngày có lớp, mode day vs week

### Import Excel
- 3 cột: Họ tên, Địa chỉ, SĐT phụ huynh
- Dedup: (tên + SĐT), HS trùng vẫn được enroll vào lớp mới
- Phone normalize: 9 số → thêm 0, validate 10 số
- Transaction safety cho import + enroll

### Export Excel
- Students: DS học sinh + lớp đang học
- Teachers: DS giáo viên + thông tin
- Class: DS HS trong lớp
- Attendance: Bảng HS × buổi (✓/✗/P) + tổng hợp
- Payments: Trạng thái thu phí (tất cả hoặc filter theo lớp)
- Reports: 3 sheets (tổng quan, lương GV, chi phí)

---

## 7. Cấu hình

### Default Admin
- Email: `admin@classmanager.local` / Password: `Admin@123`

### Chạy local
```bash
dotnet run          # Backend port 5227
npm run dev         # Frontend port 5173 (proxy /api → 5227)
```

### Deploy
- Frontend: Vercel | Backend: Render (Dockerfile .NET 10)

### Schema Patches (Program.cs, idempotent)
- Student: Phone→Address
- Class: StartDate, TotalSessions, TuitionFee, TeacherSalaryPerSession (→ đã bỏ)
- Session: Room, TimeSlot + unique index
- Attendance: Reason
- Payment: MonthOf/YearOf → ClassId + unique(StudentId,ClassId)
- Expenses table
- Teacher: SalaryPerSession → copy to Class → drop
