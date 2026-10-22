# VietQR Studio

Ứng dụng tạo mã QR chuyển khoản ngân hàng VietQR và poster PNG có thể chia sẻ. Chọn ngân hàng,
nhập số tài khoản và tên chủ tài khoản; số tiền và nội dung chuyển khoản là tùy chọn.

Thông tin được xử lý ngay trong trình duyệt. QR được tạo từ dữ liệu chuyển khoản theo định dạng
VietQR/NAPAS; ứng dụng không gửi hoặc lưu thông tin tài khoản. Danh sách ngân hàng hiện hỗ trợ
được khai báo trong `src/banks.js`.

## Chạy ứng dụng

```sh
npm install
npm run dev
```

Tạo bản production bằng `npm run build`; chạy kiểm thử định dạng QR bằng `npm test`.
