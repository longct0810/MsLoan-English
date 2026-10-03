# Changelog v0.26.0

- Thêm nộp bài bằng văn bản/tệp/audio/kết hợp và hỗ trợ thêm định dạng file học tập.
- Đưa bài chưa làm hoặc nộp trễ lên đầu danh sách cần theo dõi.
- Điểm `-1`: “Quên phiếu bài”; điểm `-2`: “Chưa hoàn thành”. Trung bình chỉ tính điểm lớn hơn 0.
- Thêm cấu hình Facebook, Messenger, Zalo theo giáo viên và hiển thị ở header phụ huynh.
- Tăng cỡ chữ giao diện cơ sở thêm một nấc.
- Cần chạy `sql/upgrade_v0.26.0.sql` để tạo bảng liên hệ và tính lại trung bình đã lưu.