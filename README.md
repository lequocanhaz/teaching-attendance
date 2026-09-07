# Teaching Attendance – Quản lý buổi dạy

Web tĩnh chạy tốt trên GitHub Pages, tập trung vào:
- Chấm công buổi dạy.
- Đổi lịch riêng một buổi.
- Sửa lịch cố định.
- Xem lịch sử theo tháng/trạng thái.
- Sao lưu/khôi phục JSON.
- Có thể đồng bộ nhiều thiết bị bằng Supabase.

## Lịch mẫu đã có sẵn

- Nam – VL12: Thứ 3, Thứ 7, Chủ nhật · 09:00–10:30
- Đức – VL12: Thứ 3, Thứ 5, Thứ 7 · 19:30–21:00
- Phát – VL10: Thứ 6 · 09:30–11:00; Chủ nhật · 14:00–15:30
- Đạt – VL10: Thứ 2, Thứ 6 · 18:00–19:30
- Triết – VL11: Thứ 4 · 16:00–17:30; Thứ 6 · 15:00–16:30

## 1. Chạy ngay, chưa cần Supabase

Chỉ cần mở `index.html`. Dữ liệu được lưu vào localStorage của trình duyệt.

Lưu ý: localStorage chỉ phù hợp để thử nghiệm hoặc dùng trên một thiết bị. Nếu xóa dữ liệu trình duyệt thì có thể mất dữ liệu.

## 2. Đưa lên GitHub Pages

1. Tạo repository mới, ví dụ `teaching-attendance`.
2. Upload toàn bộ file trong thư mục này lên nhánh `main`.
3. Vào GitHub > Settings > Pages.
4. Chọn `Deploy from a branch`.
5. Chọn branch `main`, folder `/ (root)`.
6. Save.

Sau vài phút web sẽ có địa chỉ:
`https://TEN_GITHUB.github.io/teaching-attendance/`

## 3. Dùng lâu dài với Supabase

### Bước A – Tạo database
1. Tạo project tại Supabase.
2. Mở `SQL Editor`.
3. Copy toàn bộ nội dung file `supabase.sql` và Run.

### Bước B – Lấy URL và Anon Key
Supabase > Project Settings > API.

Mở `config.js` và điền:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://....supabase.co",
  SUPABASE_ANON_KEY: "...."
};
```

Anon key có thể đặt ở frontend. KHÔNG đặt `service_role` key vào GitHub.

### Bước C – Đăng nhập
Sau khi tải lại web:
- Vào `Cài đặt`.
- Chọn `Tạo tài khoản`.
- Nếu Supabase bật xác nhận email, mở email xác nhận trước khi đăng nhập.
- Sau khi đăng nhập, dữ liệu mới sẽ lưu lên Supabase.

## 4. Quy tắc dữ liệu

- `Thời khóa biểu` = lịch cố định hàng tuần.
- `Đổi lịch buổi này` = chỉ thay đổi đúng buổi đang chọn, không ảnh hưởng lịch cố định.
- Chấm công tạo bản ghi trong lịch sử.
- Xóa lịch cố định không xóa lịch sử cũ.

## 5. Sao lưu

Vào `Cài đặt > Xuất JSON` để tải file sao lưu. Có thể nhập lại bằng `Nhập JSON`.

Nên sao lưu định kỳ, đặc biệt trước khi chỉnh sửa database.
