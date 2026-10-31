# VietQR Studio

Ứng dụng tạo mã QR chuyển khoản VietQR và poster PNG. Chọn ngân hàng, nhập số tài khoản
và tên chủ tài khoản; số tiền và nội dung chuyển khoản là tùy chọn. Mã QR và poster được
tạo ngay trên trình duyệt, thông tin không được gửi lên máy chủ.

Poster dùng ảnh nền do người dùng cung cấp tại `public/transfer-poster-background.png`.
Ảnh hiện tại có nội dung BHXH/VssID; ảnh được giữ nguyên và QR VietQR cùng thông tin người
nhận được đặt trong khung trống.

## Chạy ứng dụng

```sh
npm install
npm run dev
```

## Kiểm tra và triển khai

```sh
npm run build
npm test
```

Workflow `.github/workflows/deploy-pages.yml` chạy build và test trên pull request, sau đó
triển khai GitHub Pages khi thay đổi được đưa vào `main`. Website:
`https://phattai831986-cmyk.github.io/telegram-qr/`.
