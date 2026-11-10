# Hướng dẫn sử dụng ClassManager

Tài liệu dành cho người dùng của trung tâm: **Quản trị viên**, **Quản lý** và **Giáo viên**.
Không cần kiến thức kỹ thuật — chỉ cần biết dùng trình duyệt web.

## Mục lục

1. [Vai trò và quyền hạn](#1-vai-trò-và-quyền-hạn)
2. [Đăng nhập, đổi mật khẩu, quên mật khẩu](#2-đăng-nhập-đổi-mật-khẩu-quên-mật-khẩu)
3. [Cài ứng dụng lên điện thoại](#3-cài-ứng-dụng-lên-điện-thoại)
4. [Giao diện chung](#4-giao-diện-chung)
5. [Học sinh](#5-học-sinh)
6. [Import học sinh từ Excel](#6-import-học-sinh-từ-excel)
7. [Giáo viên](#7-giáo-viên)
8. [Lớp học](#8-lớp-học)
9. [Lịch dạy](#9-lịch-dạy)
10. [Điểm danh](#10-điểm-danh)
11. [Học phí](#11-học-phí)
12. [Báo cáo và chi phí](#12-báo-cáo-và-chi-phí)
13. [Tài khoản](#13-tài-khoản)
14. [Câu hỏi thường gặp](#14-câu-hỏi-thường-gặp)

---

## 1. Vai trò và quyền hạn

Mỗi tài khoản có một vai trò. Vai trò quyết định bạn **nhìn thấy** và **làm được** gì.

| Chức năng | Giáo viên | Quản lý | Quản trị viên |
|---|:-:|:-:|:-:|
| Xem học sinh | Chỉ HS lớp mình | Tất cả | Tất cả |
| Thêm / sửa học sinh | Lớp mình | ✓ | ✓ |
| Xoá học sinh, import Excel ở trang Học sinh | — | ✓ | ✓ |
| Thêm / import học sinh vào lớp | Lớp mình | ✓ | ✓ |
| Thêm / sửa / xoá lớp | — | ✓ | ✓ |
| Thêm / sửa / xoá giáo viên | — | — | ✓ |
| Tạo buổi học trên lịch | Lớp mình | ✓ | ✓ |
| Xoá buổi học, copy lịch tuần trước | — | ✓ | ✓ |
| Điểm danh, nhập nội dung buổi dạy | ✓ | ✓ | ✓ |
| Ghi nhận / hủy thu học phí | Lớp mình | ✓ | ✓ |
| Xem lịch sử thu / hủy thu | — | — | ✓ |
| Báo cáo tài chính, chi phí | — | — | ✓ |
| Quản lý tài khoản | — | — | ✓ |

> **Chủ trung tâm (Owner)** có mọi quyền của Quản trị viên và là người duy nhất quản lý được tài khoản Quản trị viên khác.
> Mỗi người chỉ quản lý được tài khoản có vai trò **thấp hơn** mình.

---

## 2. Đăng nhập, đổi mật khẩu, quên mật khẩu

### Đăng nhập
1. Mở địa chỉ web của trung tâm.
2. Nhập **Email** và **Mật khẩu** do quản trị viên cấp → bấm **Đăng nhập**.

Thông báo lỗi thường gặp:

| Thông báo | Nghĩa là | Cách xử lý |
|---|---|---|
| *Email hoặc mật khẩu không đúng.* | Sai email/mật khẩu, hoặc tài khoản đã bị vô hiệu hoá | Kiểm tra lại; nếu vẫn lỗi, liên hệ quản trị viên |
| *Không kết nối được máy chủ...* | Mất mạng hoặc máy chủ đang khởi động | Kiểm tra mạng, đợi 1–2 phút rồi thử lại |

### Lần đầu đăng nhập
Tài khoản mới (hoặc vừa được đặt lại mật khẩu) sẽ hiện hộp nhắc **Đổi mật khẩu**. Nên đổi ngay để chỉ mình bạn biết mật khẩu.

### Tự đổi mật khẩu
Bấm **Đổi mật khẩu** ở thanh bên (dưới tên của bạn) → nhập mật khẩu hiện tại, mật khẩu mới (ít nhất 6 ký tự) và nhập lại → lưu.

### Quên mật khẩu
Hệ thống không gửi email khôi phục. Bấm **Quên mật khẩu?** ở màn hình đăng nhập để xem hướng dẫn, sau đó:
1. Liên hệ quản trị viên trung tâm.
2. Quản trị viên đặt mật khẩu tạm cho bạn (xem [mục 13](#13-tài-khoản)).
3. Đăng nhập bằng mật khẩu tạm → hệ thống yêu cầu đổi sang mật khẩu mới.

---

## 3. Cài ứng dụng lên điện thoại

ClassManager cài được lên màn hình chính như một app, mở toàn màn hình, không cần vào App Store.

- **Android (Chrome)**: mở trang web → bấm thông báo **Cài đặt / Thêm vào màn hình chính** (hoặc menu ⋮ → *Cài đặt ứng dụng*).
- **iPhone/iPad (Safari)**: mở trang web bằng **Safari** → nút **Chia sẻ** (ô vuông có mũi tên) → **Thêm vào màn hình chính**.

App tự cập nhật khi trung tâm phát hành phiên bản mới; nếu thấy giao diện cũ, đóng hẳn app rồi mở lại.

---

## 4. Giao diện chung

- **Thanh bên trái** (trên điện thoại là menu): Học sinh · Giáo viên · Lớp học · Điểm danh & Lịch dạy · Học phí · Báo cáo* · Tài khoản* (*chỉ Quản trị viên).
- Trên máy tính, rê chuột vào thanh bên để mở rộng, bấm để thu gọn.
- Thông báo xanh/đỏ hiện ở góc màn hình sau mỗi thao tác cho biết thành công hay lỗi.
- Các thao tác xoá luôn hỏi xác nhận trước.
- Hầu hết các trang có nút **Export** để tải dữ liệu ra file Excel.

---

## 5. Học sinh

Trang **Học sinh** hiển thị danh sách (20 em/trang), số liệu tổng quan, và các lớp mỗi em đang học.

| Việc | Cách làm |
|---|---|
| Tìm học sinh | Gõ tên vào ô tìm kiếm — kết quả tự lọc |
| Sắp xếp | Bấm tiêu đề cột (Họ tên, Địa chỉ, Ngày nhập học...) |
| Thêm | **+ Thêm học sinh** → nhập Họ tên (bắt buộc), Địa chỉ, SĐT phụ huynh, Ngày sinh, Ngày nhập học, Ghi chú |
| Sửa | Bấm **Sửa** ở dòng học sinh |
| Xoá một em | Bấm **Xoá** → xác nhận |
| Xoá nhiều em | Tích ô vuông đầu các dòng → bấm nút xoá trên thanh vừa hiện |
| Xuất Excel | **Export Excel** |
| Import Excel | **Import Excel** — xem [mục 6](#6-import-học-sinh-từ-excel) |

**Lưu ý**
- **SĐT phụ huynh** phải có 10 số, bắt đầu bằng 0. Nếu nhập 9 số (thiếu số 0 đầu), hệ thống tự thêm.
- **Xoá học sinh không mất dữ liệu học phí**: em đó chỉ bị ẩn khỏi danh sách; các khoản đã thu vẫn còn trong báo cáo.
- Giáo viên chỉ thấy và sửa được học sinh thuộc lớp mình dạy.

---

## 6. Import học sinh từ Excel

Dùng để nhập nhiều học sinh một lúc, và (tuỳ chọn) xếp luôn vào một lớp.

**Có thể import ở hai nơi:**
- Trang **Học sinh** → **Import Excel** (Quản lý trở lên).
- Trang **Lớp học** → mở một lớp → **Import** (giáo viên dùng được cho lớp mình) — học sinh được xếp thẳng vào lớp đó.

### Chuẩn bị file
- File định dạng **.xlsx**.
- Cần có cột **Họ tên**. Các cột khác tuỳ chọn: **Địa chỉ**, **SĐT phụ huynh**, **Ngày sinh**, **Ngày nhập học**, **Ghi chú**.
- Dòng tiêu đề không bắt buộc ở dòng 1 — hệ thống tự tìm dòng có chữ "Họ tên" trong 20 dòng đầu.
- Ngày viết dạng `15/06/2010` (ngày/tháng/năm).
- Cách dễ nhất: **Export Excel** danh sách hiện có, sửa/thêm dòng rồi import lại — định dạng export và import giống nhau. Các cột chỉ để xem (STT, Lớp đang học) được bỏ qua khi import.

### Các bước
1. **Bước 1 — Chọn lớp** (tuỳ chọn): chọn lớp muốn xếp học sinh vào, hoặc để "Không gán vào lớp". Khi chọn lớp, có thể đặt luôn **Ngày khai giảng** cho lớp.
2. **Bước 2 — Chọn file**: chọn file .xlsx. Màn hình hiện bản xem trước và cho biết đã **nhận diện** những cột nào.
3. Bấm nút import. Nếu có học sinh nghi trùng, xem phần dưới; nút xác nhận hiện "Còn N học sinh chưa chọn" cho đến khi chọn hết, sau đó đổi thành **Xác nhận & Import**.

### Hệ thống tự xử lý gì
- **Chuẩn hoá tên**: bỏ khoảng trắng thừa, viết hoa chữ đầu mỗi từ (`nguyễn  văn a` → `Nguyễn Văn A`).
- **Dữ liệu sai không làm hỏng cả file**: SĐT hoặc ngày không hợp lệ được chuyển vào **Ghi chú** (vd. *"SĐT gốc: 09xx"*) kèm cảnh báo, học sinh vẫn được tạo.
- **Dòng thiếu họ tên** bị bỏ qua và báo lỗi theo số dòng.

### Chống trùng học sinh
| Trường hợp | Hệ thống làm gì |
|---|---|
| Trùng **tên + ngày sinh + SĐT** với học sinh đã có | Coi là cùng một em → tự **bỏ qua**, không tạo mới (nếu đang import vào lớp thì vẫn xếp em đó vào lớp) |
| Trùng **một phần** (tên + SĐT, tên + ngày sinh, hoặc chỉ trùng tên khi không có SĐT/ngày sinh) | **Hỏi bạn** — xem dưới |
| Không trùng | Tạo mới |

Khi có học sinh **nghi trùng**, hệ thống **chưa lưu gì cả** và hiện danh sách so sánh từng cặp. Với mỗi dòng, chọn:
- **Tạo mới** — đây là học sinh khác, chỉ tình cờ giống thông tin.
- **Bỏ qua** — đây chính là học sinh đã có.

Phải chọn cho **tất cả** các dòng thì nút xác nhận mới bấm được. Sau khi xác nhận, cả file được lưu một lần. Nếu bấm **Quay lại** hoặc đóng hộp thoại, không có học sinh nào bị lưu dở.

---

## 7. Giáo viên

Trang **Giáo viên** hiển thị thẻ từng giáo viên: môn dạy, SĐT, email, số lớp, và tài khoản đăng nhập đã gắn (hoặc *Chưa link*).

- **Quản trị viên**: thêm, sửa, xoá giáo viên. Quản lý trở lên: Export Excel.
- Giáo viên chỉ thấy hồ sơ của chính mình.
- Môn dạy chọn trong danh sách: Toán, Văn, Tiếng Anh, Lý, Hoá, Luyện viết TH 1–5.
- Hồ sơ giáo viên khác với **tài khoản đăng nhập**. Muốn giáo viên tự đăng nhập để điểm danh, cần tạo tài khoản vai trò Giáo viên và gắn với hồ sơ này ([mục 13](#13-tài-khoản)).

---

## 8. Lớp học

Lớp được nhóm theo **khối** (tab Tiểu học, Khối 6, Khối 7...). Mỗi thẻ lớp cho biết môn, giáo viên, sĩ số và **tiến độ** (đã dạy bao nhiêu buổi / tổng số buổi).

### Thêm / sửa lớp (Quản lý trở lên)
**+ Thêm lớp** → điền:

| Trường | Ý nghĩa |
|---|---|
| Tên lớp | Chọn **Khối** + **Nhóm** (A–F) + **Số** → tên tự ghép, vd. `7A1` |
| Môn học | Bắt buộc. Cùng tên lớp có thể có nhiều môn (7A1 Toán, 7A1 Văn), nhưng không được trùng cả tên lẫn môn |
| Giáo viên đứng lớp | Chỉ hiện giáo viên dạy đúng môn đó |
| Số buổi học | Tổng số buổi của khoá — lịch dạy không cho xếp vượt số này |
| Học phí (VNĐ) | Học phí cả khoá cho mỗi học sinh |
| % chia GV | Phần trăm giáo viên được hưởng, mặc định 75% — dùng tính lương ([mục 12](#12-báo-cáo-và-chi-phí)) |
| Ghi chú | Tuỳ ý |

### Quản lý học sinh trong lớp
Bấm vào một thẻ lớp để mở bảng chi tiết:
- **Đang học**: danh sách học sinh của lớp; bấm **Xoá** để rút em khỏi lớp (không xoá học sinh khỏi hệ thống).
- **Thêm vào lớp**: tìm học sinh → **+ Thêm**.
- **Import**: nhập học sinh từ Excel thẳng vào lớp ([mục 6](#6-import-học-sinh-từ-excel)).
- **Export Danh sách**: tải danh sách học sinh của lớp.
- **Export Điểm danh**: chọn tháng/năm → tải bảng điểm danh.

---

## 9. Lịch dạy

Vào **Điểm danh & Lịch dạy** → tab **Lịch dạy**.

- Bên trái là lịch tháng nhỏ để chọn tuần (ngày có lớp được đánh dấu). Nút **Tuần này** quay về tuần hiện tại; ◀ ▶ để chuyển tuần.
- Bên phải là lưới tuần: **5 phòng** (Phòng 1, 2, 3A, 3B, 5) × **5 ca** × 7 ngày.

| Ca | Giờ |
|---|---|
| Ca 1 | 7h15 – 9h15 |
| Ca 2 | 9h20 – 11h20 |
| Ca 3 | 14h15 – 16h15 |
| Ca 4 | 16h30 – 18h30 |
| Ca 5 | 19h – 21h |

### Tạo buổi học
1. Bấm vào **ô trống** (phòng, ca, ngày đã điền sẵn).
2. Chọn **Lớp**, nhập nội dung buổi dạy (tuỳ chọn), **GV trực ca** (tuỳ chọn) → **Tạo**.

Hệ thống báo lỗi nếu:
- Phòng/ca đó đã có lớp khác — thông báo cho biết lớp và giáo viên đang chiếm chỗ.
- Lớp đã đủ **Số buổi học** đã khai báo.

### Xem / xoá buổi học
Bấm vào ô đã có lịch để xem chi tiết: lớp, môn, giáo viên, phòng, ca, buổi thứ mấy / tổng số buổi, GV trực ca, nội dung. Quản lý trở lên có nút **Xóa buổi học**.

### Copy lịch từ tuần trước (Quản lý trở lên)
Bấm **Copy lịch từ tuần trước** → hệ thống liệt kê các buổi của tuần trước và đánh dấu buổi nào **bị trùng** phòng/ca hoặc **vượt số buổi**. Tích chọn các buổi muốn copy → xác nhận. Buổi trùng có thể chọn ghi đè. Nội dung buổi dạy để trống cho giáo viên nhập sau.

---

## 10. Điểm danh

Vào **Điểm danh & Lịch dạy** → tab **Điểm danh**.

1. Chọn ngày ở lịch bên trái → bên phải hiện các buổi học trong ngày.
2. Bấm vào một buổi để mở bảng điểm danh.
3. Với mỗi học sinh, bấm **Có mặt**, **Vắng** hoặc **Có phép**.
   - **Tự lưu ngay** khi bấm — không có nút Lưu.
   - Khi chọn Vắng/Có phép, ô **Lý do** hiện ra; nhập rồi bấm Enter hoặc bấm ra ngoài để lưu.
4. **Nội dung buổi dạy**: bấm vào dòng *"(click để nhập)"*, gõ nội dung, Enter để lưu.

---

## 11. Học phí

Trang **Học phí** liệt kê từng cặp **học sinh – lớp** với học phí của lớp và trạng thái **Đã đóng / Chưa đóng**. Mỗi học sinh đóng **một lần cho mỗi lớp**.

- **Lọc**: theo lớp, theo trạng thái (Đã đóng / Chưa đóng / Chưa có lớp), tìm theo tên; **Xóa bộ lọc** để bỏ lọc.
- **Ghi nhận thanh toán**: ở dòng *Chưa đóng* → **Ghi nhận thanh toán** → nhập số tiền (tự định dạng, vd. `500.000`) và ghi chú → lưu.
- **Hủy thu**: ở dòng *Đã đóng* → **Hủy thu** → **bắt buộc nhập lý do** → xác nhận. Dùng khi ghi nhầm.
- **Lịch sử thu / hủy thu** (Quản trị viên): xem ai thu/hủy, lúc nào, bao nhiêu tiền, lý do.
- **Export**: tải bảng học phí (của lớp đang lọc, hoặc tất cả).

> Học sinh phải được **xếp vào lớp** trước thì mới ghi nhận học phí được.
> Giáo viên chỉ thấy và thao tác được học phí của lớp mình.

---

## 12. Báo cáo và chi phí

*(Chỉ Quản trị viên)*

### Báo cáo tài chính
Chọn kỳ: **tháng**, **quý** hoặc **năm**. Báo cáo gồm:

| Chỉ số | Cách tính |
|---|---|
| Doanh thu | Tổng tiền học phí **đã thu** có ngày đóng trong kỳ |
| Doanh thu dự kiến | Tổng học phí của mọi lượt ghi danh hiện tại (học sinh đang học) |
| Chi phí giáo viên | Với mỗi lớp: **số buổi trong kỳ × số HS đang học × 35.000đ × % chia GV** |
| Chi phí khác | Chi phí phát sinh trong kỳ + chi phí cố định × số tháng của kỳ |
| Lợi nhuận | Doanh thu − (Chi phí giáo viên + Chi phí khác) |
| Tỷ lệ thu học phí | Số lượt ghi danh đã đóng / tổng số lượt ghi danh |

Kèm theo: bảng lương từng giáo viên (số buổi, lương/buổi, thành tiền), danh sách chi phí, biểu đồ doanh thu – chi phí – lợi nhuận 12 tháng, và nút xuất Excel.

### Chi phí
**Thêm chi phí** → nhập Khoản mục, Số tiền, Ngày, Ghi chú; tích ô **Chi phí cố định hàng tháng** nếu là khoản lặp lại.
- **Cố định** (có tích ô, vd. tiền thuê nhà, điện nước cố định): tự tính vào **mọi tháng**.
- **Phát sinh** (không tích, vd. mua bàn ghế): chỉ tính vào tháng của ngày đã nhập.

---

## 13. Tài khoản

*(Chỉ Quản trị viên)*

| Việc | Cách làm |
|---|---|
| Tạo tài khoản | **Tạo tài khoản mới** → Họ tên, Email, Mật khẩu (≥ 6 ký tự), Vai trò. Nếu vai trò **Giáo viên**: chọn hồ sơ giáo viên có sẵn, hoặc chọn môn dạy (+ SĐT) để tạo hồ sơ mới |
| Sửa | **Sửa** → đổi họ tên, vai trò, hồ sơ giáo viên gắn kèm |
| Đặt lại mật khẩu | **Reset PW** → nhập mật khẩu tạm → báo cho người dùng. Họ sẽ bị yêu cầu đổi mật khẩu khi đăng nhập |
| Tạm khoá | **Vô hiệu** → người đó bị đăng xuất ngay và không đăng nhập được. Bấm lại để mở khoá |
| Xoá | **Xóa** → xoá vĩnh viễn tài khoản; hồ sơ giáo viên gắn kèm bị ẩn |

**Lưu ý**
- Dấu **⚠ Chưa link GV** nghĩa là tài khoản giáo viên chưa gắn hồ sơ — giáo viên đó sẽ không thấy lớp nào.
- Không thể tự đổi vai trò, tự khoá hay tự xoá tài khoản của chính mình.
- Ưu tiên **Vô hiệu** thay vì **Xóa** khi giáo viên nghỉ, để giữ lịch sử.

---

## 14. Câu hỏi thường gặp

**Giáo viên đăng nhập nhưng không thấy lớp nào?**
Tài khoản chưa gắn hồ sơ giáo viên, hoặc hồ sơ đó chưa được chọn làm *Giáo viên đứng lớp* ở lớp nào. Quản trị viên kiểm tra ở trang Tài khoản và trang Lớp học.

**Không tạo được buổi học, báo "đã có lịch"?**
Phòng và ca đó trong ngày đã có lớp khác. Chọn phòng/ca khác hoặc nhờ quản lý xoá buổi cũ.

**Không tạo được buổi học, báo "đã đạt tối đa ... buổi"?**
Lớp đã đủ số buổi khai báo. Quản lý sửa lớp để tăng **Số buổi học** nếu cần.

**Import báo "nghi trùng" và không lưu gì?**
Đúng như thiết kế — chọn *Tạo mới* hoặc *Bỏ qua* cho từng dòng rồi xác nhận ([mục 6](#6-import-học-sinh-từ-excel)).

**Sau import, SĐT bị trống và có dòng "SĐT gốc: ..." trong ghi chú?**
SĐT trong file không hợp lệ (không đủ 10 số / có chữ). Sửa lại SĐT trong hồ sơ học sinh.

**Ghi nhận học phí nhầm số tiền?**
Bấm **Hủy thu** (nhập lý do) rồi ghi nhận lại số đúng. Cả hai thao tác đều được lưu trong lịch sử.

**Tôi bị đăng xuất đột ngột?**
Phiên đăng nhập hết hạn sau 7 ngày, hoặc tài khoản vừa bị vô hiệu hoá. Đăng nhập lại; nếu không được, liên hệ quản trị viên.

**Mở app thấy báo không kết nối được máy chủ?**
Kiểm tra mạng. Nếu mạng bình thường, máy chủ có thể đang khởi động lại — đợi 1–2 phút rồi thử lại.
