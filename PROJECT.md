# ClassManagerWeb — Tài liệu thiết kế dự án

> Mục đích: Giúp AI nắm nhanh toàn bộ tình trạng dự án để tiếp tục phát triển.
> Cập nhật lần cuối: 2026-03-24

---

## 1. Tổng quan

Ứng dụng quản lý lớp học tư nhân (gia sư / trung tâm nhỏ). Gồm:
- Quản lý học sinh, giáo viên, lớp học
- Điểm danh theo buổi học (gắn với lớp), có lý do vắng/có phép
- Học phí theo lớp (1 HS đóng 1 lần cho mỗi lớp, không theo tháng)
- Lương giáo viên theo lớp (mỗi lớp set mức lương/buổi riêng)
- Quản lý tài khoản người dùng (admin/teacher)
- Quản lý chi phí (cố định + phát sinh)
- Báo cáo doanh thu, chi phí, lợi nhuận (theo tháng/quý/năm) với biểu đồ và xuất Excel
- Import học sinh từ Excel, enroll vào lớp

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | React 19.2 + TypeScript 5.9 + Vite 8 + Tailwind CSS v4.2 |
| **Backend** | ASP.NET Core (.NET 10) — Web API |
| **Database** | PostgreSQL (Supabase cloud) |
| **ORM** | Entity Framework Core + Npgsql |
| **Auth** | JWT Bearer (HS256, 7 ngày) |
| **HTTP Client** | Axios (baseURL: `VITE_API_URL` hoặc `/api`, proxy qua Vite → `localhost:5227`) |
| **Charts** | Recharts 2.15 |
| **Excel** | XLSX 0.18.5 (FE), ClosedXML (BE export) |

---

## 3. Cấu trúc thư mục

```
ClassManagerWeb/
├── ClassManager.API/              ← Backend ASP.NET Core
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── UsersController.cs     ← Quản lý tài khoản (CRUD, reset PW, toggle)
│   │   ├── TeachersController.cs
│   │   ├── StudentsController.cs  ← Có import Excel
│   │   ├── ClassesController.cs   ← Có import + enroll
│   │   ├── AttendanceController.cs
│   │   ├── PaymentsController.cs  ← Học phí theo lớp
│   │   ├── ExpensesController.cs  ← Chi phí cố định/phát sinh
│   │   └── ReportsController.cs   ← Báo cáo + export Excel
│   ├── Services/
│   │   ├── AuthService.cs
│   │   ├── UserService.cs
│   │   ├── TeacherService.cs      ← SubjectList.Valid
│   │   ├── StudentService.cs
│   │   ├── ClassService.cs
│   │   ├── AttendanceService.cs   ← Điểm danh + lý do vắng
│   │   ├── PaymentService.cs      ← Học phí theo (StudentId, ClassId)
│   │   ├── ExpenseService.cs
│   │   ├── ReportService.cs       ← Revenue theo PaidDate, lương GV theo lớp
│   │   └── ImportService.cs
│   ├── Models/
│   │   ├── User.cs
│   │   ├── Teacher.cs
│   │   ├── Student.cs             ← Address, ParentPhone
│   │   ├── Class.cs               ← TotalSessions, TuitionFee, TeacherSalaryPerSession, StartDate
│   │   ├── StudentClass.cs
│   │   ├── Session.cs
│   │   ├── Attendance.cs          ← Status + Reason
│   │   ├── Payment.cs             ← StudentId + ClassId (không có MonthOf/YearOf)
│   │   ├── Expense.cs
│   │   └── DTOs.cs
│   ├── Data/AppDbContext.cs
│   ├── Migrations/
│   └── Program.cs                 ← DI, JWT, CORS, global error handler, auto-migrate, schema patch
│
└── class-manager-fe/              ← Frontend React
    └── src/
        ├── App.tsx                ← Routes + PrivateRoute + AdminRoute
        ├── hooks/useAuth.tsx      ← AuthContext + flushSync fix
        ├── api/index.ts           ← Axios instance + tất cả API calls (10 modules)
        ├── components/
        │   ├── Layout.tsx         ← Sidebar navigation (role-based)
        │   └── ImportModal.tsx    ← Import Excel với preview + validation
        └── pages/
            ├── LoginPage.tsx
            ├── StudentsPage.tsx   ← CRUD, search, sort, bulk delete, import
            ├── TeachersPage.tsx   ← Xem + xóa (cascade user account)
            ├── ClassesPage.tsx    ← 2-panel, CRUD, enroll/unenroll, import, lương GV/buổi
            ├── AttendancePage.tsx ← 2-panel, điểm danh auto-save, lý do vắng/có phép
            ├── PaymentsPage.tsx   ← Học phí theo lớp, filter, info popover
            ├── ReportPage.tsx     ← Dashboard cards, biểu đồ, tab GV/chi phí, export Excel
            └── AccountsPage.tsx   ← CRUD user, link teacher, reset/đổi PW, toggle active
```

---

## 4. Database Schema

### Entities & Fields

```
Users
  id, fullName, email, passwordHash (BCrypt), role ("admin"|"teacher"),
  isActive (default true), createdAt

Teachers
  id, fullName, phone, email, subject, notes,
  isActive, createdAt
  userId (nullable FK → Users, UNIQUE)

Students
  id, fullName, address, parentPhone, dateOfBirth?,
  enrolledDate, notes, isActive (soft delete), createdAt

Classes
  id, name, subject, notes,
  totalSessions (int?),
  tuitionFee (decimal? 12,2),         ← Học phí cho cả khóa
  teacherSalaryPerSession (decimal? 12,2),  ← Lương GV/buổi cho lớp này
  startDate (DateTime?),
  createdAt
  teacherId (nullable FK → Teachers)

StudentClass    ← Join table many-to-many
  studentId (FK), classId (FK), enrolledDate
  PK: (studentId, classId)

Sessions
  id, classId (FK → Classes), sessionDate, topic, notes, createdAt

Attendances
  id, studentId (FK), sessionId (FK),
  status ("Present"|"Absent"|"Excused"),
  reason (string, default "")         ← Lý do vắng/có phép
  UNIQUE: (studentId, sessionId)

Payments        ← Học phí theo lớp (1 lần/lớp, không theo tháng)
  id, studentId (FK), classId (FK),
  amount (decimal 12,2), paidDate, notes, createdAt
  UNIQUE: (studentId, classId)

Expenses
  id, title, amount (decimal 12,2), expenseDate,
  isRecurring (bool), notes, createdAt
```

### Quan hệ quan trọng
- 1 lớp có 1 giáo viên (nullable) — GV phải dạy đúng môn của lớp
- 1 học sinh học nhiều lớp (qua StudentClass)
- 1 buổi học gắn với 1 lớp → điểm danh chỉ lấy HS trong lớp đó
- 1 giáo viên có thể link 1 user account (UNIQUE, nullable)
- **Học phí theo lớp**: 1 HS đóng 1 lần cho mỗi lớp, số tiền mặc định = TuitionFee nhưng có thể sửa
- **Lương GV theo lớp**: mỗi lớp set mức lương/buổi riêng (không cố định theo GV)
- HS chưa có lớp không thể đóng học phí
- Student dùng soft delete (IsActive=false), các entity khác xóa thật
- Xóa Teacher → cascade: unlink khỏi classes + xóa user account (nếu có)

---

## 5. API Endpoints

### Auth — `/api/auth`
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| POST | `/login` | No | Đăng nhập → trả `{ token, fullName, email, role }` |
| POST | `/register` | admin | Tạo tài khoản mới |

### Users — `/api/users` (admin, trừ đổi PW của mình)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` | DS tất cả users (kèm TeacherId, TeacherName) |
| GET | `/available-teachers?forUserId=` | GV chưa link user |
| POST | `/` | Tạo user + optional tạo Teacher profile |
| PUT | `/{id}` | Cập nhật user (tên, role, teacher link) |
| POST | `/{id}/reset-password` | Admin reset PW |
| PATCH | `/{id}/toggle` | Toggle active/inactive |
| DELETE | `/{id}` | Xóa user (deactivate linked Teacher) |
| PUT | `/me/password` | User tự đổi PW |

### Teachers — `/api/teachers`
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/` | any | Admin: tất cả GV; Teacher: chỉ bản thân |
| GET | `/subjects` | any | DS môn học hợp lệ |
| GET | `/available-users` | admin | Users chưa link GV nào |
| GET | `/{id}` | any | Chi tiết GV |
| POST | `/` | admin | Tạo GV mới |
| PUT | `/{id}` | admin | Cập nhật GV |
| DELETE | `/{id}` | admin | Xóa GV + cascade user account |

### Students — `/api/students`
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/?search=` | any | Admin: tất cả; Teacher: HS của lớp mình |
| GET | `/{id}` | any | Chi tiết HS |
| POST | `/` | admin | Tạo HS |
| PUT | `/{id}` | admin | Cập nhật HS |
| DELETE | `/{id}` | admin | Soft-delete |
| GET | `/import-template` | admin | Download Excel template |
| POST | `/import` | admin | Import HS từ Excel |

### Classes — `/api/classes`
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/` | any | Admin: tất cả; Teacher: lớp của mình |
| GET | `/{id}` | any | Chi tiết lớp |
| POST | `/` | admin | Tạo lớp (kèm teacherSalaryPerSession) |
| PUT | `/{id}` | admin | Cập nhật lớp (sửa lương GV/buổi) |
| DELETE | `/{id}` | admin | Xóa lớp |
| GET | `/{id}/students` | any | DS học sinh trong lớp |
| POST | `/{id}/students` | admin | Enroll HS |
| DELETE | `/{id}/students/{sid}` | admin | Unenroll HS |
| POST | `/{id}/students/import` | admin | Import Excel + enroll |

### Attendance — `/api/attendance`
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/sessions` | any | Admin: tất cả; Teacher: sessions lớp mình |
| POST | `/sessions` | any | Tạo buổi học |
| DELETE | `/sessions/{id}` | any | Xóa buổi học |
| GET | `/sessions/{id}` | any | DS HS + trạng thái + lý do điểm danh |
| POST | `/` | any | Lưu điểm danh `{ sessionId, records[{studentId, status, reason}] }` |

### Payments — `/api/payments` (học phí theo lớp)
| Method | Path | Auth | Mô tả |
|---|---|---|---|
| GET | `/` | any | Tất cả enrollment + trạng thái thanh toán + HS chưa có lớp |
| POST | `/` | admin | Ghi nhận `{ studentId, classId, amount, notes }` |
| DELETE | `/{id}` | admin | Xóa bản ghi thanh toán |

### Expenses — `/api/expenses` (admin only)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/?month=&year=` | DS chi phí |
| POST | `/` | Tạo chi phí |
| PUT | `/{id}` | Cập nhật |
| DELETE | `/{id}` | Xóa |

### Reports — `/api/reports` (admin only)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/summary?period=&year=&month=&quarter=` | Báo cáo tổng hợp |
| GET | `/chart?year=` | Dữ liệu biểu đồ theo tháng |
| GET | `/export?period=&year=&month=&quarter=` | Xuất Excel |

---

## 6. Frontend — Pages & Routes

| Route | Component | Role | Chức năng |
|---|---|---|---|
| `/login` | LoginPage | public | Đăng nhập |
| `/students` | StudentsPage | any | CRUD HS, search, sort, bulk delete, import Excel |
| `/teachers` | TeachersPage | any | Xem DS GV, xóa (cascade) |
| `/classes` | ClassesPage | any | 2-panel, CRUD lớp (kèm lương GV/buổi), enroll/unenroll, import |
| `/attendance` | AttendancePage | any | 2-panel, điểm danh auto-save, ô lý do khi vắng/có phép |
| `/payments` | PaymentsPage | any | Học phí theo lớp, filter (tên/lớp/trạng thái/ngày), info popover |
| `/reports` | ReportPage | admin | Dashboard 4 card, biểu đồ, tab lương GV + chi phí, export Excel |
| `/accounts` | AccountsPage | admin | CRUD user, link teacher, reset/đổi PW, toggle active |

### Auth Flow
- `AuthProvider` bọc ngoài `BrowserRouter`
- `login()` dùng `flushSync` để force React flush state trước khi navigate
- `PrivateRoute` check `token`, redirect `/login` nếu null
- `AdminRoute` check `user.role === 'admin'`, redirect `/students` nếu không phải admin
- JWT lưu trong `localStorage` key `"token"` và `"user"`
- Axios interceptor: gắn Bearer token + auto-logout khi 401

### Role-based UI
- Admin: 7 mục sidebar, tất cả CRUD
- Teacher: 5 mục (ẩn Báo cáo, Tài khoản), chỉ xem dữ liệu lớp mình dạy
- Teacher xem được lương GV/buổi của lớp mình (read-only trong ClassesPage)

---

## 7. Học phí (Payment Model)

### Nghiệp vụ
- Học phí gắn theo **lớp** (course), không theo tháng
- 1 HS đăng ký 1 lớp = 1 lượt đăng ký (enrollment)
- 1 enrollment chỉ đóng **1 lần duy nhất**
- Số tiền mặc định = `Class.TuitionFee`, nhưng admin có thể sửa (giảm giá, join muộn...)
- HS chưa có lớp: hiển thị trong bảng với trạng thái "Chưa có lớp", không thể đóng tiền
- Revenue tính theo ngày đóng thực tế (`PaidDate`)

### Frontend PaymentsPage
- **Không có chọn tháng/năm** (vì payment là 1 lần)
- **Filter**: tên HS, lớp (dropdown), trạng thái (Đã đóng/Chưa đóng/Chưa có lớp), ngày đóng
- **Bảng**: Học sinh | Lớp (badge) | Trạng thái | Số tiền | Ngày đóng | Ghi chú | Icon info
- **Icon info** (popover): Giáo viên, Lớp + Môn, Học phí lớp, SĐT phụ huynh
- Popover tự mở lên/xuống tùy vị trí (tránh bị cắt ở cuối bảng)
- **Modal ghi nhận**: pre-fill số tiền = TuitionFee

---

## 8. Lương giáo viên

### Nghiệp vụ
- Lương GV tính theo **lớp**, không cố định theo GV
- Mỗi lớp có `TeacherSalaryPerSession` riêng (VD: lớp A trả 100k/buổi, lớp B trả 200k/buổi)
- Admin set lương khi tạo/sửa lớp trong ClassesPage
- Teacher xem được lương của lớp mình (read-only)

### Tính chi phí GV trong báo cáo
- Chi phí GV = Σ (số buổi dạy trong kỳ × `Class.TeacherSalaryPerSession`) cho mỗi lớp
- Nhóm theo GV khi hiển thị breakdown

---

## 9. Điểm danh

### Nghiệp vụ
- Tạo buổi học (Session) gắn với 1 lớp
- Điểm danh 3 trạng thái: Có mặt / Vắng / Có phép
- Khi chọn Vắng hoặc Có phép → hiện ô nhập **Lý do**
- **Auto-save**: click trạng thái → tự lưu ngay (không có nút "Lưu điểm danh")
- Lý do lưu khi nhấn Enter hoặc blur ra ngoài ô input

---

## 10. Báo cáo (Report)

### Cách tính
- **Revenue** = Tổng Payment.Amount trong kỳ (theo PaidDate), chỉ tính enrollment hợp lệ
- **Expected Revenue** = Σ(TuitionFee) cho tất cả enrollment active
- **Teacher Cost** = Σ(sessions × Class.TeacherSalaryPerSession) cho mỗi lớp trong kỳ
- **Expense Cost** = Chi phí phát sinh trong kỳ + (chi phí cố định × số tháng)
- **Profit** = Revenue - (Teacher Cost + Expense Cost)
- **Collection Rate** = Số enrollment đã đóng / Tổng enrollment × 100%

### Tỷ lệ thu học phí (progress bar 3 mức)
- Xanh: Đã đóng
- Đỏ: Chưa đóng (có lớp nhưng chưa đóng)
- Xám: Chưa có lớp

### Period support
- `month`: 1 tháng cụ thể
- `quarter`: 3 tháng (Q1=1-3, Q2=4-6, Q3=7-9, Q4=10-12)
- `year`: cả năm

### Tối ưu hiệu năng
- Chart data dùng grouped queries (5 query cho cả năm thay vì 36)

### Excel export (3 sheets)
1. Tổng quan: revenue, cost, profit, collection rate
2. Lương giáo viên: breakdown theo GV
3. Chi phí khác: DS chi phí

---

## 11. Import Excel

### Flow
1. User upload file `.xlsx`
2. Frontend đọc bằng thư viện `xlsx`, hiện preview
3. Validate: Họ tên bắt buộc, đếm hàng hợp lệ / lỗi
4. Gửi file lên backend (multipart/form-data)
5. Backend đọc, tạo Student, skip duplicate (name + parentPhone)
6. Nếu import vào lớp: tự động enroll

### Template (3 cột)
| A: Họ tên | B: Địa chỉ | C: SĐT phụ huynh |

### 2 chế độ
- **Students mode**: Import HS độc lập, optional chọn lớp
- **Class mode**: Import trực tiếp vào 1 lớp

---

## 12. Cấu hình môi trường

### Backend (`appsettings.json`)
```json
{
  "ConnectionStrings": { "Default": "Host=...supabase...;Port=5432;..." },
  "Jwt": { "Key": "...", "Issuer": "ClassManagerAPI", "Audience": "ClassManagerApp" },
  "AllowedOrigins": "http://localhost:5173,https://..."
}
```

### Default Admin Account (auto-created on startup)
- Email: `admin@classmanager.local`
- Password: `Admin@123`

### Frontend (`vite.config.ts`)
```ts
server: { proxy: { '/api': 'http://localhost:5227' } }
```

### Chạy local
```bash
# Backend (từ ClassManager.API/)
dotnet run          # port 5227

# Frontend (từ class-manager-fe/)
npm run dev         # port 5173
```

### Deployment
- **Frontend**: Vercel (vercel.json có SPA rewrite)
- **Backend**: Render (Dockerfile dùng .NET 10 preview)

---

## 13. Program.cs — Schema Patch (Idempotent)

Các thay đổi schema được apply bằng DDL trực tiếp trong `Program.cs` (chạy mỗi lần startup):
- Rename Student.Phone → Address
- Thêm Class.StartDate, TotalSessions, TuitionFee
- Thêm Class.TeacherSalaryPerSession (copy từ Teacher.SalaryPerSession cũ)
- Drop Teacher.SalaryPerSession
- Tạo bảng Expenses
- Thêm Attendance.Reason
- Chuyển Payment: xóa MonthOf/YearOf, thêm ClassId (FK), unique (StudentId, ClassId)
- Xóa payment rác (ClassId=0)

---

## 14. DTOs quan trọng

```csharp
// Teacher
record TeacherRequest(string FullName, string Phone, string Email, string Subject, int? UserId, string Notes);
record TeacherResponse(int Id, string FullName, string Phone, string Email, string Subject, string Notes, int ClassCount, int? UserId, string? UserEmail);

// Class
record ClassRequest(string Name, string Subject, int? TeacherId, string? Notes,
    int? TotalSessions, decimal? TuitionFee, decimal? TeacherSalaryPerSession, DateTime? StartDate);
record ClassResponse(int Id, string Name, string Subject, string? Notes,
    int StudentCount, int? TeacherId, string? TeacherName,
    int? TotalSessions, decimal? TuitionFee, decimal? TeacherSalaryPerSession, DateTime? StartDate);

// Payment (theo lớp)
record PaymentRequest(int StudentId, int ClassId, decimal Amount, string Notes);
record PaymentStatusItem(int StudentId, string StudentName, int ClassId, string? ClassName, string? Subject,
    string? TeacherName, string? ParentPhone, decimal TuitionFee,
    bool HasClass, bool IsPaid, int? PaymentId, decimal Amount, DateTime? PaidDate, string Notes);
record PaymentListResponse(List<PaymentStatusItem> Items, decimal TotalCollected,
    int TotalEnrollments, int PaidCount, int UnpaidCount);

// Attendance
record AttendanceItem(int StudentId, string StudentName, string Status, string Reason);
record SaveAttendanceRequest(int SessionId, List<AttendanceItem> Records);

// Report
record ReportSummary(decimal Revenue, decimal ExpectedRevenue,
    decimal TeacherCost, decimal ExpenseCost, decimal TotalCost, decimal Profit,
    int TotalEnrollments, int PaidEnrollments, int NoClassStudents, decimal CollectionRate,
    List<TeacherCostItem> TeacherBreakdown, List<ExpenseResponse> ExpenseBreakdown);
```

---

## 15. Subject List (cố định)

```
Toán, Văn, Tiếng Anh, Lý, Hoá,
Luyện viết TH 1, Luyện viết TH 2, Luyện viết TH 3,
Luyện viết TH 4, Luyện viết TH 5
```

---

## 16. API Client (Frontend)

File `api/index.ts` export 10 modules:
```
authApi, teachersApi, studentsApi, classesApi, attendanceApi,
paymentsApi, usersApi, importApi, expensesApi, reportsApi
```

`paymentsApi`:
- `getAll()` — không có filter tháng/năm
- `record({ studentId, classId, amount, notes })`
- `delete(id)`

---

## 17. TODO / Tính năng có thể mở rộng

| Tính năng | Mô tả | Ưu tiên |
|---|---|---|
| **Thêm môn học** | Subject list hiện hardcode — cần UI để mở rộng | Thấp |
| **Dashboard cho Teacher** | Teacher login chỉ thấy overview lớp mình | Trung bình |
| **Notification** | Nhắc học phí chưa đóng, buổi học sắp tới | Thấp |
| **Phân quyền chi tiết GV** | GV chỉ xem/sửa dữ liệu lớp mình | Trung bình |
