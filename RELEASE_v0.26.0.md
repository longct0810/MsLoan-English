# English Classroom v0.26.0

Nộp bài tập đa phương thức, làm rõ mã điểm trạng thái, ưu tiên bài cần phụ huynh theo dõi, và bổ sung thông tin liên hệ giáo viên trong Parent Portal.

## Included

- Submission modes: text, file, audio, and mixed text/file.
- Attachments accept PDF, Word, Excel, PowerPoint, plain text/CSV, JPEG/PNG/WebP, and supported audio types.
- Unsubmitted and late assignments appear before submitted/graded work.
- Score `-1` displays as “Quên phiếu bài”; score `-2` displays as “Chưa hoàn thành”. Averages ignore all scores less than or equal to zero.
- Teacher-managed Facebook, Messenger, and Zalo URLs appear in the parent portal header.
- Shared base body font size increases from 16px to 17px.

## Database

Run `sql/upgrade_v0.26.0.sql`. It creates `teacher_social_links` and recomputes `student_progress_summary.average_score` from positive scores only.

## Checks

`npm test`