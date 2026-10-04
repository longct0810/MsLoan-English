# Triển khai v0.26.0

1. Sao lưu PostgreSQL rồi chạy toàn bộ `sql/upgrade_v0.26.0.sql` nếu chưa chạy.
2. Triển khai source: `npm ci`, `npm start`. Không chạy cumulative `db/schema.sql` trên database production đang có dữ liệu.
3. Giáo viên vào **Liên hệ phụ huynh** (`/teacher/social-links`) để lưu Facebook, Messenger và Zalo. Các nút xuất hiện trên header phụ huynh theo giáo viên của lớp học viên đang chọn.
4. Chạy đồng bộ lại Google Sheets để các ô `-1` và `-2` trước đây bị giữ ở staging được cập nhật thành kết quả.
5. Kiểm tra nộp bài với các chế độ văn bản, file, audio và kết hợp. File hỗ trợ PDF, Word, Excel, PowerPoint, văn bản, hình ảnh, âm thanh và video MP4/WebM/MOV.

`-1` hiển thị **Quên phiếu bài**, `-2` hiển thị **Chưa hoàn thành**. Điểm trung bình chỉ lấy điểm > 0 và quy về thang 10. Bài chưa nộp/nộp trễ được ưu tiên ở trang học viên; bài cần theo dõi hoặc chấm được ưu tiên ở danh sách giáo viên.

Giới hạn file dùng `ASSIGNMENT_UPLOAD_MAX_FILES` (mặc định 3) và `ASSIGNMENT_UPLOAD_MAX_FILE_MB` (mặc định 10 MB/tệp). Tệp mới thay thế bộ tệp cũ; nếu không chọn tệp mới, giữ tệp đã nộp. Bài đã chấm khóa nộp lại. Chế độ văn bản vẫn yêu cầu nội dung, file đính kèm là tùy chọn.

## Kiểm thử

Copy `.env.example` thành `.env` cho môi trường kiểm thử riêng, rồi chạy `DEMO_MODE=true npm test`. Bộ kiểm thử bao gồm HTTP đăng nhập, nộp multipart, giới hạn file, quyền truy cập, CSRF, liên hệ phụ huynh, mã điểm đặc biệt và trung bình. Kiểm thử khóa khi chấm/nộp đồng thời dùng PostgreSQL client giả lập; chưa chạy migration hoặc kiểm thử trên database production.
