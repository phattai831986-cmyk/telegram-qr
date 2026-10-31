# Hướng dẫn BHXH số

Trang khách hiển thị poster hướng dẫn BHXH/VssID với mã QR dẫn đến trang chủ chính thức
`https://baohiemxahoi.gov.vn/`. Không cần trang quản trị, tài khoản, Supabase hoặc cấu hình
bí mật. Người dùng có thể tải poster đã ghép mã QR dưới dạng PNG.

## Chạy ứng dụng

```sh
npm install
npm run dev
```

Mã QR hiện dẫn đến trang chủ BHXH Việt Nam. Vị trí QR được đặt cố định trên ảnh poster
`public/bhxh-guide-template.png`.

## Kiểm tra và triển khai

```sh
npm run build
npm test
```

Workflow `.github/workflows/deploy-pages.yml` chạy build/test trên pull request và triển khai
GitHub Pages khi có commit lên `main` hoặc khi chạy thủ công. Website:
`https://phattai831986-cmyk.github.io/telegram-qr/`.
