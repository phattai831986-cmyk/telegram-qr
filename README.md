# Hướng dẫn BHXH số

Trang khách hiển thị poster hướng dẫn BHXH/VssID với mã QR tới một trang HTTPS thuộc tên miền
`baohiemxahoi.gov.vn` hoặc `vssid.gov.vn`. Trang `/admin.html` cho phép tài khoản được cấp quyền
đăng nhập, thay ảnh poster và chỉnh vị trí/kích thước mã QR. Poster khách tải xuống được ghép ngay
trong trình duyệt.

## Chạy ứng dụng

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Điền URL Supabase và publishable/anon key vào `.env`. Không đặt `service_role` key trong ứng dụng
trình duyệt.

## Cấu hình Supabase

1. Tạo một dự án Supabase và chạy `supabase/migrations/20261101000000_bhxh_guide_portal.sql`
   trong SQL Editor.
2. Tạo tài khoản quản trị trong **Authentication → Users**. Tắt public sign-up để người khác
   không tự đăng ký; đăng nhập admin chỉ dành cho tài khoản được cho phép trong bảng `admin_users`.
3. Sao chép UUID người dùng admin từ Auth Users rồi chạy trong SQL Editor:

   ```sql
   insert into public.admin_users (user_id) values ('ADMIN_USER_UUID');
   ```

4. Đặt `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` trong file `.env` khi chạy local. Trên
   GitHub, đặt hai giá trị này tại **Settings → Secrets and variables → Actions → Variables** để
   workflow Pages đưa cấu hình công khai vào bản build. Đây là anon/publishable key; không dùng
   service-role key.
5. Mở `/admin.html`, đăng nhập, nhập liên kết hướng dẫn chính thức và tải ảnh poster. Ảnh thay thế
   cần giữ tỉ lệ dọc 881:1280 để QR đặt đúng vị trí. Có thể kéo khung QR trên ảnh xem trước hoặc
   chỉnh tọa độ/kích thước, rồi nhấn **Lưu cấu hình**.

RLS giới hạn việc sửa cấu hình và tải ảnh lên cho UUID có trong `admin_users`; khách chỉ đọc cấu
hình công khai. Bucket poster là công khai để trang khách tải ảnh. Liên kết đích bị giới hạn vào
các tên miền BHXH/VssID đã nêu.

## Kiểm tra và triển khai

```sh
npm run build
npm test
```

Workflow `.github/workflows/deploy-pages.yml` chạy build/test trên pull request và triển khai
GitHub Pages khi có commit lên `main` hoặc khi chạy thủ công. Website:
`https://phattai831986-cmyk.github.io/telegram-qr/`.
