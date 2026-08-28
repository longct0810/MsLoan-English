# English Classroom v0.20.0 - Google Sheets Data Source

Baseline: **v0.19.1**.

Module này biến Google Sheet theo dõi của giáo viên thành một nguồn dữ liệu định kỳ cho PostgreSQL/Neon. Google Sheet vẫn là nơi giáo viên thao tác quen thuộc; PostgreSQL vẫn là source of truth của ứng dụng.

## Nguồn đã chuẩn bị sẵn trên giao diện

- Spreadsheet ID: `1Pf4YrlHn-8JQIDCIjQR0Szumitn8Yt-v_QxAPF-JO_I`
- gid: `0`
- Tên file: `KHỐI 5 LÊN 6 2026 2027`
- Chu kỳ mặc định: 15 phút

Form `Nguồn dữ liệu` đã prefill URL trên. Giáo viên chỉ cần chọn đúng lớp trong database rồi lưu.

## Các lớp dữ liệu

1. `external_data_sources`: cấu hình nguồn.
2. `external_sync_runs`: lịch sử mỗi lần đồng bộ.
3. `external_student_links`: mapping tên học sinh trong Sheet -> `students.id`.
4. `external_observations`: staging/audit cho từng ô dữ liệu.
5. `external_session_links`: map ngày trong Sheet -> `class_sessions.id`.
6. Dữ liệu an toàn được materialize sang:
   - `student_scores`
   - `student_skill_events`
   - `session_attendance`
   - `teacher_notes`

Homework/assignment status chưa tự động ghi vào `assignment_submissions` ở v0.20.0 vì tên cột Sheet không đủ để xác định chắc chắn `assignment_id`. Chúng vẫn được lưu đầy đủ trong `external_observations` với type `HOMEWORK_STATUS` để mapping ở phiên bản sau.

## Nguyên tắc an toàn

- Không tự tạo học sinh mới chỉ dựa vào tên trong Sheet.
- Auto-match chỉ khi tên chuẩn hóa trùng chính xác duy nhất trong lớp.
- Mapping thủ công được giữ nguyên, sync sau không ghi đè.
- Không DELETE dữ liệu nghiệp vụ khi ô trong Sheet bị xóa.
- Điểm danh nhập thủ công trong app không bị Google Sheet ghi đè.
- Ghi chú import từ Sheet mặc định `is_parent_visible = false`.
- Ngày tương lai chỉ lưu staging và không materialize vào core DB.
- `import_from_date` mặc định lấy năm bắt đầu của `classes.school_year`; ví dụ `2026-2027` -> `2026-01-01`.
- SHA-256 content hash bỏ qua các lần Sheet không thay đổi.
- PostgreSQL advisory lock chống chạy trùng khi PM2 cluster/nhiều instance.

## 1. Upgrade Neon

Chạy:

```bash
psql "$DATABASE_URL" -f sql/neon_upgrade_v0.20.0.sql
```

Hoặc dán file SQL vào Neon SQL Editor.

## 2. Tích hợp module vào app v0.19.1

Copy:

```text
src/modules/data-sources/
src/jobs/google-sheet-sync.job.js
views/teacher/data-sources/
```

Vào project hiện tại.

Module không thêm npm dependency mới. Yêu cầu Node.js >= 18 vì dùng native `fetch`.

Xem file `INTEGRATION_v0.19.1.md` để mount route và scheduler.

## 3. Env

Thêm các biến từ `.env.v0.20.0.example`:

```env
GOOGLE_SHEET_SYNC_ENABLED=true
GOOGLE_SHEET_SYNC_TICK_MS=60000
GOOGLE_SHEET_FETCH_TIMEOUT_MS=15000
GOOGLE_SHEET_FETCH_RETRIES=2
```

`GOOGLE_SHEET_SYNC_TICK_MS` chỉ là nhịp scheduler thức dậy. Chu kỳ thực tế của từng source nằm trong `external_data_sources.sync_interval_minutes`.

## 4. Cấu hình nguồn

Mở:

```text
/teacher/data-sources
```

Chọn lớp và lưu Google Sheets URL.

Lần sync đầu:

1. tải CSV public của Sheet;
2. nhận dạng header ngày + header chi tiết;
3. chuẩn hóa tên học sinh;
4. lưu toàn bộ ô vào staging;
5. materialize các điểm / điểm danh / ghi chú có mapping an toàn;
6. hiển thị học sinh chưa map để giáo viên liên kết thủ công.

## 5. CLI test một lần

Sau khi migration và copy module:

```bash
node scripts/google-sheet-sync-cli.js \
  --teacher-id 1 \
  --class-id 5 \
  --url "https://docs.google.com/spreadsheets/d/1Pf4YrlHn-8JQIDCIjQR0Szumitn8Yt-v_QxAPF-JO_I/edit?gid=0#gid=0" \
  --from 2026-01-01 \
  --force
```

Hoặc nếu source đã đăng ký:

```bash
node scripts/google-sheet-sync-cli.js --source-id 1 --force
```

## 6. Kiểm tra

```bash
node --test test/google-sheet-csv.test.js
```

Patch hiện có 8 unit tests cho CSV parser, tiếng Việt, score/attendance/CEFR/note classifier, 2 kiểu header ngày và kiểm tra ngày tương lai.

## 7. Lưu ý riêng với Sheet hiện tại

Sheet có một số header năm cần kiểm tra thủ công, ví dụ dữ liệu ngày mang năm 2025/2027 nằm xen giữa các cột năm 2026. Module không tự “sửa đoán” năm. Các ngày tương lai bị chặn khỏi core DB; ngày trước `import_from_date` cũng chỉ ở staging/không materialize.

## 8. Khi chuyển file sang Private

v0.20.0 dùng public Viewer CSV để triển khai nhanh. Bước hardening tiếp theo nên dùng Google Service Account read-only và đổi file về Private. Lúc đó chỉ thay adapter fetch; parser/mapping/staging/materialization không cần đổi.
