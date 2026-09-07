# Teaching Attendance V4 – Lịch cá nhân & chấm công

## Cách hoạt động

- **Dạy thêm**: lịch cố định lặp hằng tuần, có chấm công và có thể đổi riêng từng buổi.
- **Lịch học đại học**: môn học cố định lặp ở các tuần sau. Nếu một tuần không học, chọn **Bỏ tuần này**; tuần sau vẫn còn.
- **Kiến tập / Thực tập**: thêm theo ngày cụ thể khi có lịch.
- **Lịch học phát sinh / đổi buổi**: có thể thêm theo ngày cụ thể.
- **Lịch sử tuần**: quay về tuần cũ để xem đúng lịch cũ; các môn được sửa cố định dùng ngày hiệu lực nên không làm thay đổi các tuần trước.
- **Thời gian thực**: đồng hồ và trạng thái Sắp tới / Đang diễn ra / Đã qua.

## Lịch mẫu

### Dạy thêm
- Nam – VL12: T3, T7, CN · 09:00–10:30
- Đức – VL12: T3, T5, T7 · 19:30–21:00
- Phát – VL10: T6 · 09:30–11:00; CN · 14:00–15:30
- Đạt – VL10: T2, T6 · 18:00–19:30
- Triết – VL11: T4 · 16:00–17:30; T6 · 15:00–16:30

### Môn học đại học
- T3 13:00–15:35 — Kiểm tra đánh giá trong dạy học Vật lí — A5-404A
- T4 07:50–09:35 — Thực hành dạy học Vật lí — A5-404A
- T5 07:00–09:35 — Quản lí Nhà nước về giáo dục — A1-102
- T5 09:40–12:15 — Vật lí thống kê — A1-101

## Supabase

Nếu đã dùng Supabase ở bản cũ, hãy mở **SQL Editor**, dán toàn bộ `supabase.sql` bản V4 và Run lại. File này tạo thêm bảng `schedule_exceptions` dùng để lưu các môn học bị bỏ riêng ở từng tuần.

Sau đó giữ nguyên `config.js` với Project URL và Publishable/Anon key. Không dùng `service_role` key ở frontend.

## Sao lưu

Cài đặt → Xuất JSON. Bản sao lưu V4 gồm lịch dạy, môn học cố định, lịch theo ngày, ngoại lệ từng tuần và lịch sử chấm công.
