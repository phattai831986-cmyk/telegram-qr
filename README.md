# VietQR Studio

Ứng dụng tạo mã QR chuyển khoản VietQR và poster PNG. Chọn ngân hàng, nhập số tài khoản
và tên chủ tài khoản; số tiền và nội dung chuyển khoản là tùy chọn. QR luôn được tạo trên
trình duyệt. Nếu muốn đồng bộ qua nhiều thiết bị, đăng nhập và chủ động lưu hồ sơ/poster
vào Supabase riêng tư; dữ liệu không được lưu nếu bạn chưa nhấn nút lưu.

Poster dùng ảnh nền do người dùng cung cấp tại `public/transfer-poster-background.png`.
Ảnh hiện tại có nội dung BHXH/VssID; ảnh được giữ nguyên và QR VietQR cùng thông tin người
nhận được đặt trong khung trống.

Poster dùng ảnh nền do người dùng cung cấp tại `public/transfer-poster-background.png`.
Ảnh hiện tại có nội dung BHXH/VssID; ảnh được giữ nguyên và QR VietQR cùng thông tin người
nhận được đặt trong khung trống.

## Chạy ứng dụng

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào `.env` nếu muốn dùng đồng bộ.
Không dùng khóa `service_role` trong trình duyệt.

## Cấu hình đồng bộ Supabase

1. Tạo project Supabase, rồi chạy `supabase/migrations/20261101035254_private_transfer_sync.sql`
   trong **SQL Editor**.
2. Trong **Authentication → URL Configuration**, thêm địa chỉ GitHub Pages vào danh sách
   **Redirect URLs**. Bật xác nhận email nếu muốn yêu cầu người dùng xác minh email.
3. Sao chép Project URL và anon/publishable key (không phải `service_role`) vào `.env` khi chạy
   local. Trên GitHub, đặt hai giá trị làm Actions Variables tên
   `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` để bật đăng nhập trên website.
4. Tạo tài khoản bằng email và mật khẩu ở mục “Lưu tài khoản và poster”. Đăng nhập cùng tài khoản
   trên thiết bị khác để tải thông tin và poster đã lưu.

RLS giới hạn hồ sơ và ảnh poster trong tài khoản đã đăng nhập; bucket ảnh là riêng tư. Nút chia sẻ
mở bảng chia sẻ của thiết bị để gửi ảnh qua Telegram hoặc ứng dụng khác nếu trình duyệt hỗ trợ.
Nếu không hỗ trợ chia sẻ ảnh trực tiếp, poster được tải xuống để bạn đính kèm thủ công.

## Mở ứng dụng trong Telegram

Trang đã tích hợp Telegram Mini Apps JavaScript API: ứng dụng báo sẵn sàng và mở rộng khung
trong Telegram, điều chỉnh chiều cao theo viewport, nhận màu nền Telegram, và dùng nút hành
động native để tạo QR hoặc tải poster. Khi mở bằng trình duyệt thông thường, các tính năng web
hiện có vẫn hoạt động bình thường.

Để gắn trang vào bot:

1. Triển khai phiên bản ứng dụng lên GitHub Pages tại
   `https://phattai831986-cmyk.github.io/telegram-qr/`.
2. Mở `@BotFather` trong Telegram, tạo bot bằng `/newbot` nếu chưa có.
3. Dùng `/newapp`, chọn bot, đặt tên/ảnh và nhập URL GitHub Pages ở trên làm URL Mini App.
4. Dùng `/setmenubutton` trong BotFather để đặt nút menu và URL Mini App cho bot.
5. Mở Mini App từ menu bot để kiểm tra trên Telegram iOS/Android/Desktop.

Cài đặt bot trong BotFather cần tài khoản Telegram của chủ ứng dụng. Không cần đưa bot token
vào mã web. Ứng dụng hiện không dùng dữ liệu `initData` để xác thực người dùng; đồng bộ tài
khoản vẫn đăng nhập riêng qua Supabase. Chia sẻ poster qua bảng chia sẻ của thiết bị nếu
Telegram hỗ trợ; nếu không, tải PNG rồi đính kèm vào chat/nhóm.

## Kiểm tra và triển khai

```sh
npm run build
npm test
```

Workflow `.github/workflows/deploy-pages.yml` chạy build và test trên pull request, sau đó
triển khai GitHub Pages khi thay đổi được đưa vào `main`. Website:
`https://phattai831986-cmyk.github.io/telegram-qr/`.
