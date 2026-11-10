# ClassManagerWeb — Tài liệu thiết kế dự án

> Mục đích: Giúp dev/AI nắm nhanh toàn bộ tình trạng dự án để tiếp tục phát triển.
> Cập nhật lần cuối: 2026-11-10
>
> Tài liệu liên quan: [README.md](README.md) (kiến trúc C4, chạy local) · [docs/HUONG_DAN_SU_DUNG.md](docs/HUONG_DAN_SU_DUNG.md) (hướng dẫn người dùng)

---
## 1. Tổng quan

Ứng dụng quản lý trung tâm dạy học tư nhân. Gồm:
- Quản lý học sinh, giáo viên, lớp học (nhóm theo khối, card grid)
- Điểm danh theo buổi + lịch dạy calendar (phòng × ca × tuần)
- Quản lý học phí: ghi nhận thu, hủy thu (bắt buộc nhập lý do), audit log
- Quản lý lương giáo viên
- Quản lý tài khoản (4 vai trò: owner/admin/manager/teacher)
- Chi phí cố định + phát sinh
- Báo cáo tài chính (tháng/quý/năm) + biểu đồ + Excel export
- Export Excel cho tất cả tabs
- Import học sinh từ Excel (auto-detect header, dedup 3 tầng, plan-then-commit)
- Quên mật khẩu: admin reset → user bắt buộc đổi MK khi đăng nhập
- PWA: cài được lên màn hình điện thoại
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
| **PWA** | vite-plugin-pwa + Workbox |

---

## 3. Flow xử lý & Luồng hoạt động

### 3.1 Luồng đăng nhập
```
User → LoginPage → POST /api/auth/login → { token, fullName, email, role, mustChangePassword }
  → Lưu token + user vào localStorage
  → Axios interceptor gắn Bearer token mọi request
  → 401 → auto clear + redirect /login (không reload nếu đang ở /login)
  → mustChangePassword = true → Layout hiện popup nhắc đổi mật khẩu

Lỗi đăng nhập ở LoginPage:
  401           → "Email hoặc mật khẩu không đúng."
  không response → "Không kết nối được máy chủ..." (mạng/CORS/server đang khởi động)
  khác          → message từ server

Mỗi request đã xác thực:
  JWT middleware → middleware tự viết kiểm tra Users.IsActive (cache 60s qua UserStatusCache,
  invalidate khi khoá/xoá user)
  → tài khoản bị vô hiệu hoá → 401 "Tài khoản đã bị vô hiệu hóa." (kể cả token còn hạn)
```

### 3.1b Luồng quên mật khẩu
```
LoginPage → "Quên mật khẩu?" → hiện hướng dẫn liên hệ admin (không có email reset)
Admin → AccountsPage → "Reset PW" → POST /api/users/{id}/reset-password { newPassword }
  → Hash MK mới + MustChangePassword = true
User đăng nhập bằng MK tạm → popup bắt đổi → PUT /api/users/me/password
  → verify MK cũ, MK mới ≥ 6 ký tự → MustChangePassword = false
```

### 3.2 Luồng quản lý học sinh
```
Admin tạo HS thủ công:
  StudentsPage → Form → POST /api/students → DB

Import Excel (chi tiết ở mục 7 "Import Excel"):
  StudentsPage (manager+) hoặc ClassesPage → panel lớp → "Import" (teacher: lớp mình)
  → ImportModal: Bước 1 chọn lớp (tuỳ chọn, set được ngày khai giảng)
                 Bước 2 chọn .xlsx → FE preview + hiện cột nhận diện
  → Không chọn lớp: POST /api/students/import       (multipart: file, dupDecisions?)
    Có chọn lớp:    POST /api/classes/{id}/students/import
  → Backend: parse → chuẩn hoá → phân loại TOÀN BỘ dòng trước khi ghi
    → Còn dòng nghi trùng chưa có quyết định → KHÔNG ghi gì, trả suspects[]
      → FE bắt user chọn "Tạo mới"/"Bỏ qua" cho từng dòng → gửi lại cả file + dupDecisions
    → Đủ quyết định → 1 lần SaveChanges tạo tất cả HS mới
    → Có lớp: enroll mọi HS ứng với các dòng (mới tạo hoặc đã có), trong 1 transaction

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

  Teacher chỉ tạo được buổi cho lớp mình; xoá buổi: manager+

Xem chi tiết:
  Click ô filled → Floating modal hiện: lớp, môn, GV, phòng, ca, buổi X/Y, GV trực ca, nội dung

Copy lịch tuần trước (manager+):
  "Copy lịch từ tuần trước" → GET /api/attendance/sessions/copy-preview?week=<monday>
  → Preview danh sách buổi tuần trước, đánh dấu conflict / vượt TotalSessions
  → User tích chọn → POST /api/attendance/sessions/copy-week?week=<monday>  body: [sessionIds]
  → Trả { created, replaced, skipped }; buổi conflict được chọn sẽ bị ghi đè; topic để trống
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
  Login → JWT chứa claims: NameIdentifier(userId), Email, Role, Name
  → Backend: [Authorize(Roles = Roles.ManagerUp / Roles.AdminUp)] trên endpoints
  → Controller: CallerTeacherIdAsync() = null nếu manager+, ngược lại = Teacher.Id của user
    → truyền vào service để lọc (teacher chỉ thấy lớp/HS/sessions/payments của mình)
  → Frontend: useAuth() → canManage (manager+), canAdmin (admin+) → ẩn/hiện UI

Thứ bậc vai trò (Models/User.cs → Roles):
  owner(4) > admin(3) > manager(2) > teacher(1)
  - Owner chỉ tạo qua cấu hình (Owner:Email/Password), không gán được qua UI
  - Tạo/sửa/reset/khoá/xoá user: chỉ với user có role THẤP HƠN mình (owner được tất cả)
  - Không tự đổi role / tự khoá / tự xoá chính mình
  - Non-owner không thấy owner trong danh sách
  - Role teacher bắt buộc gắn Teacher profile (chọn có sẵn hoặc tạo inline với môn + SĐT)
  - Khoá user → Teacher.IsActive đồng bộ theo; xoá user → Teacher bị unlink + IsActive=false
```

### 3.7 Luồng học phí
```
Ghi nhận thu:
  PaymentsPage → Nút "Ghi nhận" (chỉ hiện khi chưa đóng)
  → Modal nhập số tiền + ghi chú
  → POST /api/payments → lưu Payment + ghi PaymentLog (action="thu")

Hủy thu:
  PaymentsPage → Nút "Hủy thu" (chỉ hiện khi đã đóng)
  → Modal bắt buộc nhập lý do
  → DELETE /api/payments/{id}?reason=... → xóa Payment + ghi PaymentLog (action="hủy_thu")
  → Teacher chỉ hủy lớp mình, manager+ hủy tự do

Xem lịch sử (admin+):
  PaymentsPage → Nút "Xem lịch sử" (vàng)
  → GET /api/payments/logs → Modal bảng log: thời gian, người thực hiện, hành động, HS, lớp, số tiền, lý do
```

---

## 4. Database Schema

```
Users: id, fullName, email, passwordHash(BCrypt), role("owner"|"admin"|"manager"|"teacher"),
  isActive, mustChangePassword, createdAt

Teachers: id, fullName, phone, email, subject, notes, isActive, createdAt, userId(FK→Users, UNIQUE nullable)

Students: id, fullName, address, parentPhone, dateOfBirth?, enrolledDate, notes, isActive(soft delete), createdAt

Classes: id, name, subject, notes, totalSessions(int?), tuitionFee(decimal?), teacherSharePercent(int, default 75),
  startDate?, createdAt, teacherId(FK→Teachers nullable)
  UNIQUE: (name + subject)

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

PaymentLogs: id, userId, userName, action("thu"|"hủy_thu"), studentId, studentName,
  classId, className, amount(12,2), reason, createdAt

Expenses: id, title, amount(12,2), expenseDate, isRecurring, notes, createdAt
```

### DB Indexes (performance)
- StudentClasses: StudentId, ClassId
- Sessions: ClassId, SessionDate
- Attendances: SessionId
- Payments: ClassId, PaidDate

---

## 5. API Endpoints

Quyền ghi trong ngoặc; không ghi = mọi user đã đăng nhập (teacher bị lọc theo lớp mình).

### Health
- GET/HEAD `/health` (không cần token)

### Auth `/api/auth`
- POST `/login` (anonymous) | POST `/register` (admin+) | PUT `/change-password`

### Users `/api/users` (admin+)
- GET `/` | POST `/` | PUT `/{id}` | DELETE `/{id}`
- POST `/{id}/reset-password` | PATCH `/{id}/toggle` | PUT `/me/password`
- GET `/available-teachers`

### Teachers `/api/teachers`
- GET `/` (teacher: chỉ hồ sơ mình) | GET `/{id}` | POST `/` (admin+) | PUT `/{id}` (admin+) | DELETE `/{id}` (admin+)
- GET `/subjects` | GET `/available-users` (admin+) | GET `/export` (manager+)

### Students `/api/students`
- GET `/?search=` | GET `/{id}` | POST `/` (teacher, manager+) | PUT `/{id}` (teacher: HS lớp mình) | DELETE `/{id}` (manager+, soft delete)
- GET `/export` | GET `/import-template` | POST `/import` (manager+, multipart `file` + `dupDecisions` JSON `{row: "create"|"skip"}`)

### Classes `/api/classes`
- GET `/` | GET `/{id}` | POST `/` (manager+) | PUT `/{id}` (manager+) | DELETE `/{id}` (manager+)
- GET `/{id}/students` | POST `/{id}/students` (teacher: lớp mình) | DELETE `/{id}/students/{sid}` (teacher: lớp mình)
- POST `/{id}/students/import` (teacher: lớp mình) | GET `/{id}/export` | GET `/{id}/export-attendance?month=&year=`

### Attendance `/api/attendance`
- GET `/sessions?week=` | POST `/sessions` (teacher: lớp mình) | DELETE `/sessions/{id}` (manager+)
- GET `/sessions/copy-preview?week=` (manager+) | POST `/sessions/copy-week?week=` body `[sessionIds]` (manager+)
- PUT `/sessions/{id}/topic` (teacher: lớp mình) | GET `/sessions/{id}` (teacher: lớp mình) | POST `/` (teacher: lớp mình; lưu điểm danh: validate status, chỉ nhận HS thuộc lớp, xoá record cũ của session rồi ghi lại)

### Payments `/api/payments`
- GET `/` | POST `/` | DELETE `/{id}?reason=` | GET `/export?classId=`
- GET `/logs` (admin+)

### Expenses `/api/expenses` (admin+)
- GET `/?month=&year=` | POST `/` | PUT `/{id}` | DELETE `/{id}`

### Reports `/api/reports` (admin+)
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
| `/payments` | Filter 4 chiều, ghi nhận/hủy thu, lịch sử log (admin+), export |
| `/reports` | Báo cáo tổng hợp, biểu đồ, export Excel |
| `/accounts` | CRUD user, link teacher, reset/đổi PW, toggle active |

### Design System
- **Theme**: Đỏ #DE2228 (primary) + Vàng #F6AB10 (accent)
- **Sidebar**: Collapsible (hover expand, click → collapse), gradient đỏ đậm, SVG icons, avatar
- **Modals**: Backdrop blur + gradient đỏ-vàng nhẹ, rounded-2xl, shadow-2xl
- **Components**: Toast, ConfirmDialog, LoadingSkeleton, EmptyState, StatCard, Badge
- **Animations**: fadeIn, slideIn, shake, shimmer skeleton, toast in/out
- **Lazy loading**: TeachersPage, ClassesPage, AttendancePage, PaymentsPage, AccountsPage

### UI Components
- **CurrencyInput**: format tiền tự động (500000 → 500.000), dùng cho học phí + thanh toán
- **Modals**: backdrop blur gradient đỏ-vàng, click outside đóng

### Phân quyền UI
- Owner/Admin: 7 mục sidebar, tất cả CRUD + xem log học phí
- Manager: 7 mục sidebar, CRUD + hủy thu + copy lịch tuần
- Teacher: 5 mục (ẩn Báo cáo + Tài khoản), chỉ xem lớp mình, sửa nội dung buổi dạy
- Teacher có thể: thêm/import HS vào lớp mình, ghi nhận/hủy thu lớp mình

### PWA
- `vite-plugin-pwa` với `registerType: autoUpdate`
- Service Worker cache static assets + NetworkFirst cho API calls
- Manifest: `display: standalone`, theme `#DE2228`, icons 192+512px
- iOS: `apple-mobile-web-app-capable` meta tag cho fullscreen mode
- Cài: Chrome Android → banner tự hiện | Safari iOS → Share → "Thêm vào màn hình chính"

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
- Copy tuần trước: preview danh sách buổi, đánh dấu conflict/limit, cho phép ghi đè buổi conflict
- Tên lớp unique theo (name + subject): 7A1 Toán + 7A1 Văn OK, 7A1 Toán + 7A1 Toán lỗi

### Điểm danh
- Auto-save khi click trạng thái (không cần nút Lưu)
- Ô lý do hiện khi Vắng/Có phép, lưu khi blur/Enter
- Mini calendar highlight ngày có lớp (mode day cho điểm danh, mode week cho lịch dạy)

### Học phí
- Mỗi HS chỉ có 1 bản ghi payment/lớp — UNIQUE(studentId, classId)
- Hủy thu bắt buộc nhập lý do
- PaymentLogs ghi lại toàn bộ: ai thu/hủy, khi nào, bao nhiêu, lý do
- GET /payments/logs chỉ admin+ xem được
- Routing: `[HttpGet("logs")]` phải đặt TRƯỚC `[HttpGet]` để tránh conflict với `DELETE /{id}`

### Import Excel (`Services/ImportService.cs`)
- **Định dạng chuẩn** (dùng chung với Export học sinh → round-trip export → sửa → import được):
  `Họ tên *`, `Địa chỉ`, `SĐT phụ huynh`, `Ngày sinh`, `Ngày nhập học`, `Ghi chú`.
  Cột read-only khi export (STT, Lớp đang học) bị bỏ qua khi import.
- **Auto-detect header**: quét 20 dòng đầu tìm ô khớp alias "Họ tên" (`Họ và tên`, `Tên học sinh`, `FullName`...); không thấy → coi dòng 1 là header. Map cột theo `ColumnAliases`.
- **Chuẩn hoá**: tên qua `NameHelper.NormalizeVietnamese` (trim, gộp space, Title Case); so sánh dedup bằng `NormalizeForCompare` (lowercase).
- **Dữ liệu sai → ghi chú, không lỗi**: SĐT (`PhoneHelper.TryNormalize`) hoặc ngày (`dd/MM/yyyy`, `d/M/yyyy`, `yyyy-MM-dd`, ...) không hợp lệ → để trống field, thêm `"SĐT gốc: ..."` / `"Ngày sinh gốc: ..."` vào Notes + warning. Dòng thiếu tên → error.
- **Dedup 3 tầng** (so với HS active trong DB **và** các dòng trước trong cùng file):
  1. Exact `tên + ngày sinh + SĐT` → tự skip (vẫn enroll nếu import vào lớp)
  2. Partial `tên + SĐT` | `tên + ngày sinh` | `tên` (chỉ khi dòng không có SĐT lẫn ngày sinh) → **suspect**, cần quyết định `create`/`skip`
  3. Không khớp → tạo mới
- **Plan-then-commit**: phân loại hết rồi mới ghi. Còn suspect chưa quyết → trả `suspects` (kèm `ExistingRow` nếu trùng dòng khác trong file), **không ghi gì**. FE không có quyết định mặc định; nút xác nhận disable đến khi quyết hết.
- Import vào lớp: bọc transaction, enroll các HS chưa có trong lớp.
- FE khi set ngày khai giảng ở ImportModal gửi lại đủ field của lớp (tránh xoá teacher/notes/học phí/% chia).

### Báo cáo (`Services/ReportService.cs`)
- **Doanh thu** = tổng `Payment.Amount` có `PaidDate` trong kỳ.
- **Doanh thu dự kiến** = tổng `Class.TuitionFee` của mọi StudentClass có HS active (không theo kỳ).
- **Lương GV** (mỗi lớp) = `số buổi trong kỳ × số HS active trong lớp × 35.000 × TeacherSharePercent/100`. Hằng số `RATE_PER_STUDENT = 35000` hard-code ở 2 chỗ trong ReportService.
- **Chi phí** = chi phí phát sinh có `ExpenseDate` trong kỳ + tổng chi phí `IsRecurring` × số tháng của kỳ.
- **Lợi nhuận** = Doanh thu − (Lương GV + Chi phí).
- **Tỷ lệ thu** = số (HS, lớp) đang ghi danh đã có Payment / tổng số ghi danh.
- Biểu đồ `/chart?year=`: 12 tháng revenue / totalCost / profit.

### Danh mục cố định (hard-code trong Services)
- Môn (`SubjectList`): Toán, Văn, Tiếng Anh, Lý, Hoá, Luyện viết TH 1–5.
- Phòng (`RoomList`), Ca (`TimeSlotList`): xem mục Lịch dạy ở trên.
- FE nhóm lớp theo khối từ tên lớp: số 1–5 → "Tiểu học", ≥ 6 → "Khối N".

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
- **PWA Workbox**: cache static assets, NetworkFirst cho API (timeout 10s)

---

## 9. Cấu hình

### Khoá cấu hình backend
`appsettings.json` KHÔNG commit (trong .gitignore) — dùng `appsettings.example.json` làm mẫu. Trên server có thể đặt bằng biến môi trường, dùng `__` thay cho `:` (vd. `ConnectionStrings__Default`, `Jwt__Key`).

| Khoá | Bắt buộc | Ý nghĩa |
|---|---|---|
| `ConnectionStrings:Default` | ✓ | Chuỗi kết nối PostgreSQL |
| `Jwt:Key` | ✓ | Secret HS256, ≥ 32 ký tự |
| `Jwt:Issuer`, `Jwt:Audience` | ✓ | `ClassManagerAPI` / `ClassManagerApp` |
| `AllowedOrigins` | ✓ nếu FE khác domain | Danh sách origin CORS, phân tách bằng dấu phẩy |
| `Owner:Email`, `Owner:Password` | Production | Khi khởi động: tạo owner nếu chưa có email này; nếu user đã tồn tại thì nâng role lên owner (không đổi mật khẩu) |
| `Backdoor:Key` | Không | Bật kill-switch khẩn cấp: đăng nhập bằng email trigger đặc biệt + key này → vô hiệu hoá và đổi MK ngẫu nhiên **mọi tài khoản trừ owner**. Không đặt key = tắt. Xem `AuthService.LoginAsync` |
| `ASPNETCORE_ENVIRONMENT` | | `Development` bật seed owner mặc định |

### Frontend
| Biến build | Ý nghĩa |
|---|---|
| `VITE_API_URL` | Base URL API. Không đặt → `/api` (cùng domain; dev dùng Vite proxy) |

### Owner mặc định (chỉ Development)
- Nếu môi trường Development, không cấu hình `Owner:*` và chưa có owner → tạo `admin@classmanager.local` / `Admin@123`.
- Ở môi trường **không phải** Development, tài khoản `admin@classmanager.local` bị **xoá** mỗi lần khởi động.

### Chạy local
```bash
dotnet run          # Backend port 5227
npm run dev         # Frontend port 5173 (proxy /api → 5227)
```
Chi tiết: [README.md](README.md#chạy-local).

### Deploy (hiện tại)
- Frontend: Vercel (`vercel.json` rewrite mọi route → `index.html`)
- Backend: Render, build từ `ClassManager.API/Dockerfile` (build context = thư mục gốc repo), port 8080
- Database: Supabase PostgreSQL (`SSL Mode=Require`)
- Keep-alive: UptimeRobot ping `HEAD /health` để Render free tier không ngủ
- `.npmrc` có `legacy-peer-deps=true` để Vercel resolve vite-plugin-pwa với Vite 8
- Kế hoạch: chuyển toàn bộ (FE + API + DB) về server riêng — tài liệu `docs/DEPLOY.md` sẽ bổ sung khi chốt phương án

### Khởi động backend (Program.cs) — thứ tự
1. `db.Database.Migrate()` — chạy EF migrations
2. Schema patches SQL idempotent (bên dưới)
3. Seed / nâng quyền owner từ cấu hình; xoá seed account trên production
4. Pipeline: ExceptionHandler → CORS → Authentication → active-user middleware → Authorization → Controllers

### Schema Patches (Program.cs, idempotent)
- Student: Phone→Address
- Class: StartDate, TotalSessions, TuitionFee
- Session: Room, TimeSlot, DutyTeacher + unique index
- Attendance: Reason
- Payment: MonthOf/YearOf → ClassId + unique(StudentId,ClassId)
- Expenses table
- Class: TeacherSharePercent (default 75)
- Session: DutyTeacher
- Performance indexes (7 indexes)
- Users: MustChangePassword
- PaymentLogs table
- (Lịch sử) Class: TeacherSalaryPerSession — cột còn trong DB nhưng **không còn dùng** (lương GV giờ tính theo công thức % chia, xem mục Báo cáo)

> Quy ước: thay đổi schema mới nên dùng EF migration (`dotnet ef migrations add ...`) thay vì thêm patch SQL vào Program.cs.

---

## 10. Tồn đọng kỹ thuật / lưu ý

| # | Vấn đề | Vị trí | Ghi chú |
|---|---|---|---|
| 1 | Active-user middleware cache `IsActive` trong bộ nhớ 60s (`UserStatusCache`) | `Program.cs`, `Services/UserStatusCache.cs` | Chỉ đúng khi API chạy **1 instance**. Code mới đổi `User.IsActive` hoặc xoá user phải gọi `UserStatusCache.Invalidate` |
| 2 | Dockerfile dùng image `10.0-preview` | `ClassManager.API/Dockerfile` | Nên chuyển sang `mcr.microsoft.com/dotnet/sdk:10.0` / `aspnet:10.0` |
| 3 | `RATE_PER_STUDENT = 35000` hard-code, lặp 2 lần | `ReportService` | Nên đưa vào cấu hình hoặc một hằng số chung |
| 4 | Comment trong `Models/Session.cs` (Room/TimeSlot) đã cũ | `Session.cs` | Giá trị đúng ở `RoomList`/`TimeSlotList` |
| 5 | Kill-switch đăng nhập (email trigger) nằm trong mã nguồn | `AuthService.LoginAsync` | Chỉ chạy khi có `Backdoor:Key`; giữ key bí mật, cân nhắc nếu repo public |
| 6 | Ảnh QR trỏ tới domain production | `class-manager-fe/public/qr-classmanager.png` | Phải tạo lại khi đổi domain |
| 7 | `class-manager-fe/README.md` vẫn là README mẫu của Vite | | Thông tin dự án nằm ở README gốc |
