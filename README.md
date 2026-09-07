# Teaching Attendance V3 – Lịch cá nhân & chấm công

Bản V3 tập trung vào sử dụng lâu dài:

- Đồng hồ thời gian thực ngay trên web.
- Hiển thị trạng thái `Đang diễn ra / Sắp tới / Đã qua` theo giờ hiện tại.
- Lịch dạy thêm là lịch cố định và có chấm công.
- Lịch học đại học và kiến tập/thực tập được lưu theo **ngày cụ thể**, vì vậy mỗi tuần có thể khác nhau.
- Có nút chuyển tuần và xem lại mọi tuần cũ.
- Có nút `Sao chép lịch học/KT từ tuần trước` để tạo tuần mới nhanh rồi sửa các buổi thay đổi.
- Khi sửa lịch dạy cố định, hệ thống tạo phiên bản mới từ ngày áp dụng để không làm sai lịch sử cũ.
- Supabase hỗ trợ lưu online và đồng bộ thay đổi giữa nhiều thiết bị.

## Cách dùng lịch tuần

1. Vào `Lịch tuần`.
2. Dùng mũi tên để chuyển tuần hoặc chọn một ngày ở ô bên phải.
3. `+ Lịch học / KT-TT` để thêm lịch riêng của đúng tuần đó.
4. Khi sang tuần mới, có thể bấm `Sao chép lịch học/KT từ tuần trước`, sau đó sửa/xóa/thêm các buổi khác.
5. Tuần cũ không bị ghi đè; quay lại tuần cũ bằng mũi tên để xem lịch sử.

## Supabase V3

Nếu chưa dùng Supabase thì web chạy ngay bằng localStorage.

Nếu đã hoặc sắp kết nối Supabase:

1. Mở Supabase > SQL Editor.
2. Chạy **toàn bộ** file `supabase.sql` bản V3.
3. Trong `config.js` điền Project URL và Publishable/Anon key.
4. Không bao giờ đưa `service_role` hoặc Secret key vào GitHub.

V3 tạo thêm bảng `weekly_events` để lưu lịch học/kiến tập theo ngày và bật Realtime cho các bảng.

## Backup

Vào `Cài đặt > Xuất JSON`. File backup V3 chứa:

- `schedules`: lịch dạy cố định và các phiên bản lịch cũ.
- `sessions`: lịch sử chấm công/đổi buổi dạy.
- `weekly_events`: lịch học và kiến tập/thực tập từng tuần.
