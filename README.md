# VietQR Studio

Ứng dụng tạo mã QR chuyển khoản VietQR và poster PNG. Chọn ngân hàng, nhập số tài khoản
và tên chủ tài khoản; số tiền và nội dung chuyển khoản là tùy chọn. Người dùng phải đăng nhập
bằng email và được chủ ứng dụng phê duyệt trước khi công cụ tạo QR xuất hiện. Hồ sơ ngân hàng
và poster chỉ được đồng bộ riêng tư sau khi người dùng chủ động lưu.

Poster dùng ảnh nền do người dùng cung cấp tại `public/transfer-poster-background-20261102.png`.
Ảnh hiện tại là mẫu BHXH/VssID; ứng dụng đặt QR VietQR vào khung trống ở giữa poster.

## Chạy ứng dụng

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Điền `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` vào `.env` để bật đăng nhập và duyệt quyền.
Không dùng khóa `service_role` trong trình duyệt.

## Cấu hình đăng nhập, duyệt quyền và đồng bộ Supabase

1. Tạo project Supabase, rồi chạy lần lượt các migration
   `supabase/migrations/20261101035254_private_transfer_sync.sql` và
   `supabase/migrations/20261101050000_multiple_transfer_profiles.sql` trong **SQL Editor**.
   Nếu đã chạy migration đầu tiên, chỉ cần chạy migration thứ hai để nâng cấp danh sách tài khoản.
2. Chạy migration `supabase/migrations/20261103120000_email_access_approval.sql` để bật yêu cầu
   phê duyệt. Tạo và xác nhận tài khoản email của chủ ứng dụng trước, sau đó chạy đoạn SQL dưới
   đây trong **SQL Editor**, thay địa chỉ mẫu bằng email đăng nhập của chủ ứng dụng. Chỉ tài khoản
   được thêm vào `app_access_admins` mới thấy trang quản lý và duyệt người dùng.

   ```sql
   do $$
   declare
     admin_user_id uuid;
   begin
     select id into admin_user_id
     from auth.users
     where lower(email) = lower('THAY_BANG_EMAIL_CHU_UNG_DUNG');

     if admin_user_id is null then
       raise exception 'Không tìm thấy tài khoản. Hãy tạo và xác nhận tài khoản email trước.';
     end if;

     insert into public.app_access_admins (user_id)
     values (admin_user_id)
     on conflict (user_id) do nothing;
   end $$;
   ```

3. Trong **Authentication → URL Configuration**, thêm địa chỉ GitHub Pages vào danh sách
   **Redirect URLs**. Bật xác nhận email nếu muốn yêu cầu người dùng xác minh email.
4. Sao chép Project URL và anon/publishable key (không phải `service_role`) vào `.env` khi chạy
   local. Trên GitHub, đặt hai giá trị làm Actions Variables tên
   `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` để bật đăng nhập trên website.
5. Người dùng tạo tài khoản/đăng nhập bằng email, rồi chọn “Gửi yêu cầu sử dụng”. Chủ ứng dụng
   đăng nhập bằng email quản trị để duyệt, từ chối hoặc thu hồi quyền trong mục “Quản lý quyền truy cập”.
   Người dùng chỉ mở được công cụ sau khi được duyệt. Đăng nhập cùng tài khoản trên thiết bị khác
   để tải thông tin và poster đã lưu.

Mã nguồn của GitHub Pages vẫn được tải công khai. Cổng duyệt khóa giao diện ứng dụng cho người dùng
thông thường, nhưng không thể ngăn người rành kỹ thuật bỏ qua giao diện tĩnh hoặc chạy mã riêng.
Đây không phải cơ chế bảo vệ cho nội dung bí mật hay dịch vụ thanh toán phía máy chủ.

Bạn có thể lưu nhiều tài khoản ngân hàng. Chọn “Tài khoản cố định” để luôn dùng tài khoản mặc định;
chọn “Tài khoản tùy chọn” để đổi giữa các tài khoản đã lưu. Đặt tài khoản đang chọn làm mặc định
bằng nút “Đặt làm tài khoản cố định”. Mỗi người dùng chỉ có thể xem và thay đổi danh sách tài khoản
của chính mình.

RLS giới hạn hồ sơ và ảnh poster trong tài khoản đã đăng nhập; bucket ảnh là riêng tư. Nút chia sẻ
mở bảng chia sẻ của thiết bị để gửi ảnh qua Telegram hoặc ứng dụng khác nếu trình duyệt hỗ trợ.
Nếu không hỗ trợ chia sẻ ảnh trực tiếp, poster được tải xuống để bạn đính kèm thủ công.
Nút “Chia sẻ liên kết qua Telegram” mở bộ chọn chat/nhóm Telegram cùng URL Mini App. Việc gửi
ảnh poster là thao tác riêng: dùng “Chia sẻ ảnh poster” rồi chọn Telegram nếu thiết bị hỗ trợ,
hoặc tải PNG và tự đính kèm. Telegram không gửi ảnh trực tiếp chỉ bằng liên kết chia sẻ.

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
vào mã web. Ứng dụng không dùng dữ liệu `initData` để nhận dạng người dùng; mọi người đăng nhập
bằng email Supabase và phải được chủ ứng dụng phê duyệt, dù mở từ Telegram hay trình duyệt.
Chia sẻ poster qua bảng chia sẻ của thiết bị nếu
Telegram hỗ trợ; nếu không, tải PNG rồi đính kèm vào chat/nhóm.

## Kiểm tra và triển khai

```sh
npm run build
npm test
```

Workflow `.github/workflows/deploy-pages.yml` chạy build và test trên pull request, sau đó
triển khai GitHub Pages khi thay đổi được đưa vào `main`. Website:
`https://phattai831986-cmyk.github.io/telegram-qr/`.
