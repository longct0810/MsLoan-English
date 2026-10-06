# Changelog v0.26.2

- Tự động nén video nộp bài sang MP4 H.264 (CRF 22, preset medium), giữ nguyên độ phân giải và âm thanh AAC 128 kbps.
- Chỉ lưu bản nén nếu nhỏ hơn file gốc; video còn lại được giữ nguyên nếu nén không giảm dung lượng.
- Cài FFmpeg trên máy chủ; không cần migration DB.
