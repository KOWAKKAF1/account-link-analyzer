# Account Link Analyzer

Ứng dụng tĩnh để phân tích file CSV/TSV/Excel và gom nhóm tài khoản có dấu hiệu trùng thông tin.

## Cách dùng

1. Mở `index.html` bằng trình duyệt.
2. Kéo-thả file CSV/TSV/Excel vào vùng chọn file.
3. Kiểm tra phần ánh xạ cột dữ liệu, chỉnh lại nếu app nhận diện chưa đúng.
4. Chọn ngưỡng nghi ngờ và số dấu hiệu tối thiểu.
5. Bấm `Phân tích`, sau đó xuất kết quả bằng CSV hoặc JSON.

## Cách tính điểm

Mỗi cặp tài khoản được so sánh theo các trường đã ánh xạ. Dấu hiệu càng mạnh thì điểm càng cao:

- CCCD/CMND/Hộ chiếu: 60
- Tài khoản ngân hàng: 50
- Email, thiết bị: 45
- Số điện thoại: 40
- Mật khẩu/hash: 35
- Loại thiết bị/browser: 24
- IP: 20
- Tên miền: 16
- Đại lý cấp cao, tên ngân hàng: 12
- Họ tên, ngày sinh, địa chỉ: 16-18

Các tài khoản được nối thành cùng một nhóm nếu cặp kết nối vượt ngưỡng và đủ số dấu hiệu tối thiểu.

App cũng có thêm nhóm `Mẫu nhân viên`, học theo file tham khảo:

- Cùng ngân hàng, cùng đầu số tài khoản, cùng tên miền đăng ký, cùng loại thiết bị/browser.
- Có thêm đại lý cấp cao nếu cột này có dữ liệu.
- Tự gắn nhãn nguy hiểm 100% cho browser Opera, Brave hoặc Edge.
- Với nhóm đủ lớn, app hiển thị đề xuất đối chiếu KM F68K rồi đưa vào lạm dụng/cấm khuyến mãi nếu khớp.
- `Mẫu nhân viên` là logic nền, có thể bổ sung dần từ cách xử lý manual của nhiều nhân viên.
- Đầu số tài khoản mặc định lấy 4 số đầu.
- Có thể chỉnh `Cỡ nhóm mẫu tối thiểu` trong thanh bên, mặc định là 5.

Quy tắc hạ rủi ro:

- Nhóm quá lớn mà chỉ dựa trên tín hiệu phổ biến sẽ được gắn `Phổ thông` hoặc `Cần lọc thêm`.
- Những nhóm này không tự động kết luận lạm dụng.
- Chỉ nhóm có tín hiệu mạnh như fingerprint/device id, phone/email, CCCD, hash hoặc browser nguy hiểm mới được ưu tiên xử lý.

## Ghi chú

- Dữ liệu được xử lý trong trình duyệt, không gửi lên máy chủ.
- File Excel dùng thư viện SheetJS tải qua CDN. Nếu muốn chạy hoàn toàn offline, hãy xuất Excel sang CSV trước.
- Với file lớn, nên lọc trước còn các cột cần phân tích để app chạy nhanh hơn.
- File `sample-data.csv` có thể dùng để thử nhanh.
