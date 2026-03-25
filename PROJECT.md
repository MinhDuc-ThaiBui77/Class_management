# ClassManagerWeb — Tài liệu thiết kế dự án

> Mục đích: Giúp AI nắm nhanh toàn bộ tình trạng dự án để tiếp tục phát triển.
> Cập nhật lần cuối: 2026-03-25

---

## 1. Tổng quan

Ứng dụng quản lý trung tâm dạy học tư nhân. Gồm:
- Quản lý học sinh, giáo viên, lớp học (nhóm theo khối, card grid)
- Điểm danh theo buổi + lịch dạy calendar (phòng × ca × tuần)
- Quản lý học phí và lương giáo viên
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

## 3. Flow xử lý & Luồng hoạt động

### 3.1 Luồng đăng nhập
```
User → LoginPage → POST /api/auth/login → JWT token
  → Lưu token + user vào localStorage
  → Axios interceptor gắn Bearer token mọi request
  → 401 → auto clear + redirect /login
```

### 3.2 Luồng quản lý học sinh
```
Admin tạo HS thủ công:
  StudentsPage → Form → POST /api/students → DB

Admin import Excel:
  StudentsPage → ImportModal → Upload .xlsx → FE preview
  → POST /api/students/import → Backend parse Excel
  → Dedup (tên + SĐT) → Tạo mới / skip trùng
  → Optional: enroll vào lớp (POST /api/classes/{id}/students/import)
  → Transaction: import + enroll atomic

Xóa HS (soft delete):
  DELETE /api/students/{id} → IsActive = false
  → Payment records giữ nguyên
```

### 3.3 Luồng quản lý lớp học
```
Admin tạo lớp:
  ClassesPage → Form (khối + nhóm + số → tên lớp)
  → Validate: tên unique, GV đúng môn
  → POST /api/classes → DB

Enroll HS vào lớp:
  ClassesPage → Panel "Thêm vào lớp" → Search HS → Click "+ Thêm"
  → POST /api/classes/{id}/students → StudentClass record
  → Local state update (không reload toàn bộ)

Unenroll HS:
  ClassesPage → Panel "Đang học" → Click "Xóa"
  → DELETE /api/classes/{id}/students/{sid}
  → Local state update
```

### 3.4 Luồng xếp lịch dạy
```
Admin vào tab Lịch dạy → Calendar tuần hiển thị:
  - Mini calendar (trái) chọn tuần, highlight ngày có lớp
  - Grid 5 phòng × 5 ca × 7 ngày (phải)
  - Ô trống = click để tạo
  - Ô filled = nền đỏ nhạt, hiện "GV · Lớp"

Tạo buổi:
  Click ô trống → Popup (phòng+ca+ngày pre-fill)
  → Chọn lớp, nhập nội dung, GV trực ca
  → POST /api/attendance/sessions
  → Backend validate:
    1. Phòng hợp lệ? Ca hợp lệ?
    2. Conflict check (cùng ngày+phòng+ca đã có?)
       → Nếu conflict: báo "Phòng X ca Y đã có lịch: Lớp A - GV B"
    3. Session limit (đã đạt TotalSessions?)
       → Nếu đạt: báo "Lớp X đã đạt tối đa Y buổi"
  → Tạo Session record + trả sessionIndex

Xem chi tiết:
  Click ô filled → Floating modal hiện: lớp, môn, GV, phòng, ca, buổi X/Y, GV trực ca, nội dung
```

### 3.5 Luồng điểm danh
```
GV/Admin vào tab Điểm danh:
  - Mini calendar (trái) chọn ngày
  - Danh sách buổi hôm đó (phải) dạng cards
  - Click card → Bảng điểm danh mở ra

Điểm danh:
  Click trạng thái (Có mặt / Vắng / Có phép) → Auto-save ngay
  → POST /api/attendance { sessionId, records[] }
  → Nếu Vắng/Có phép → hiện ô "Lý do" → blur/Enter → auto-save

GV sửa nội dung buổi dạy:
  Click "(click để nhập)" → Input → blur/Enter
  → PUT /api/attendance/sessions/{id}/topic
```

### 3.6 Luồng quản lý tài khoản
```
Admin tạo account:
  AccountsPage → Form (tên, email, PW, role)
  → Nếu role=teacher: chọn GV có sẵn hoặc tạo mới (môn + SĐT)
  → POST /api/users → User + optional Teacher record

Phân quyền runtime:
  Login → JWT chứa role claim
  → Backend: [Authorize(Roles = "admin")] trên endpoints
  → Frontend: isAdmin check → ẩn/hiện UI elements
  → Teacher chỉ thấy: lớp mình dạy, HS mình, sessions mình
```

---

## 4. Database Schema

```
Users: id, fullName, email, passwordHash(BCrypt), role("admin"|"teacher"), isActive, createdAt

Teachers: id, fullName, phone, email, subject, notes, isActive, createdAt, userId(FK→Users, UNIQUE nullable)

Students: id, fullName, address, parentPhone, dateOfBirth?, enrolledDate, notes, isActive(soft delete), createdAt

Classes: id, name(UNIQUE), subject, notes, totalSessions(int?), tuitionFee(decimal?), startDate?, createdAt, teacherId(FK→Teachers nullable)

StudentClass: studentId(FK), classId(FK), enrolledDate — PK(studentId,classId)

Sessions: id, classId(FK), sessionDate,
  room("Phòng 1"|"Phòng 2"|"Phòng 3A"|"Phòng 3B"|"Phòng 5"),
  timeSlot("Ca 1 (7h15-9h15)"|"Ca 2 (9h20-11h20)"|"Ca 3 (14h15-16h15)"|"Ca 4 (16h30-18h30)"|"Ca 5 (19h-21h)"),
  topic, notes, dutyTeacher, createdAt
  UNIQUE: (sessionDate, room, timeSlot)

Attendances: id, studentId(FK), sessionId(FK), status("Present"|"Absent"|"Excused"), reason
  UNIQUE: (studentId, sessionId)

Payments: id, studentId(FK), classId(FK), amount(12,2), paidDate, notes, createdAt
  UNIQUE: (studentId, classId)

Expenses: id, title, amount(12,2), expenseDate, isRecurring, notes, createdAt
```

### DB Indexes (performance)
- StudentClasses: StudentId, ClassId
- Sessions: ClassId, SessionDate
- Attendances: SessionId
- Payments: ClassId, PaidDate

---

## 5. API Endpoints

### Auth `/api/auth`
- POST `/login` | POST `/register`

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
- PUT `/sessions/{id}/topic` | GET `/sessions/{id}` | POST `/`

### Payments `/api/payments`
- GET `/` | POST `/` | DELETE `/{id}` | GET `/export?classId=`

### Expenses `/api/expenses` (admin)
- GET `/?month=&year=` | POST `/` | PUT `/{id}` | DELETE `/{id}`

### Reports `/api/reports` (admin)
- GET `/summary?period=&year=&month=&quarter=`
- GET `/chart?year=` | GET `/export?...`

---

## 6. Frontend

### Pages
| Route | Chức năng |
|---|---|
| `/login` | 2-column login (brand panel + form) |
| `/students` | Stat cards, table + pagination 20/page, search debounce, sort, bulk delete, import/export |
| `/teachers` | Card grid, avatar chữ cái, subject badge, export |
| `/classes` | Tabs khối + card grid (progress bar), panel HS (search + sort), export DS + điểm danh |
| `/attendance` | Tab Điểm danh (mini calendar + cards ngày) + Tab Lịch dạy (mini calendar + grid tuần compact) |
| `/payments` | Filter 4 chiều, info popover, export (tất cả hoặc theo lớp) |
| `/reports` | Báo cáo tổng hợp, biểu đồ, export Excel |
| `/accounts` | CRUD user, link teacher, reset/đổi PW, toggle active |

### Design System
- **Theme**: Đỏ #DE2228 (primary) + Vàng #F6AB10 (accent)
- **Sidebar**: Collapsible (hover expand, click → collapse), gradient đỏ đậm, SVG icons, avatar
- **Modals**: Backdrop blur + gradient đỏ-vàng nhẹ, rounded-2xl, shadow-2xl
- **Components**: Toast, ConfirmDialog, LoadingSkeleton, EmptyState, StatCard, Badge
- **Animations**: fadeIn, slideIn, shake, shimmer skeleton, toast in/out
- **Lazy loading**: TeachersPage, ClassesPage, AttendancePage, PaymentsPage, AccountsPage

### Phân quyền UI
- Admin: 7 mục sidebar, tất cả CRUD
- Teacher: 5 mục (ẩn Báo cáo + Tài khoản), chỉ xem lớp mình, sửa nội dung buổi dạy

---

## 7. Nghiệp vụ quan trọng

### Lịch dạy
- 5 phòng: Phòng 1, Phòng 2, Phòng 3A, Phòng 3B, Phòng 5
- 5 ca: Ca 1 (7h15-9h15), Ca 2 (9h20-11h20), Ca 3 (14h15-16h15), Ca 4 (16h30-18h30), Ca 5 (19h-21h)
- GV trực ca: field riêng cho mỗi buổi
- Conflict check: cùng ngày + phòng + ca → lỗi chi tiết
- Session limit: không vượt TotalSessions
- Session index: hiện "buổi X/Y"
- Calendar compact: ô 28px, chỉ hiện "GV · Lớp", click → modal chi tiết

### Điểm danh
- Auto-save khi click trạng thái (không cần nút Lưu)
- Ô lý do hiện khi Vắng/Có phép, lưu khi blur/Enter
- Mini calendar highlight ngày có lớp (mode day cho điểm danh, mode week cho lịch dạy)

### Import Excel
- 3 cột: Họ tên, Địa chỉ, SĐT phụ huynh
- Dedup: (tên + SĐT), HS trùng vẫn enroll vào lớp mới
- Phone normalize: 9 số → thêm 0, validate 10 số
- Transaction safety: import + enroll atomic

### SĐT
- Toàn project: 10 số, bắt đầu bằng 0
- Auto-prefix: 9 số → thêm 0 đầu
- Apply: Student, Teacher, User, Import Excel

---

## 8. Performance

- **DB indexes**: 7 indexes cho StudentClasses, Sessions, Payments, Attendances
- **Report queries**: Gộp queries để giảm roundtrip DB
- **Search debounce**: 300ms cho student search
- **Lazy loading**: React.lazy + Suspense cho 5 pages (trừ Login, Students, Report)
- **Stale-while-revalidate**: Cache data, hiện ngay khi revisit
- **Local state update**: Enroll/unenroll không reload toàn bộ class list
- **Cache students**: ClassesPage load all students 1 lần on mount

---

## 9. Cấu hình

### Default Admin
- Email: `admin@classmanager.local` / Password: `Admin@123`

### Chạy local
```bash
dotnet run          # Backend port 5227
npm run dev         # Frontend port 5173 (proxy /api → 5227)
```

### Deploy
- Frontend: Vercel | Backend: Render (Dockerfile .NET 10)
- `appsettings.json` KHÔNG commit (trong .gitignore), dùng `appsettings.example.json` làm template

### Schema Patches (Program.cs, idempotent)
- Student: Phone→Address
- Class: StartDate, TotalSessions, TuitionFee
- Session: Room, TimeSlot, DutyTeacher + unique index
- Attendance: Reason
- Payment: MonthOf/YearOf → ClassId + unique(StudentId,ClassId)
- Expenses table
- Performance indexes (7 indexes)
