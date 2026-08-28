# English Classroom v0.20.0 - Google Sheets Data Source

Baseline: **v0.19.1**. Bản source này đã được merge hoàn chỉnh; không cần copy patch thủ công.

## Chức năng

- Google Sheet của giáo viên trở thành một nguồn dữ liệu định kỳ cho PostgreSQL/Neon.
- Chu kỳ mặc định 15 phút theo từng nguồn; scheduler thức dậy mỗi 60 giây để tìm source đến hạn.
- SHA-256 bỏ qua lần Sheet không thay đổi.
- PostgreSQL advisory lock chống ghi trùng khi chạy nhiều PM2 worker.
- Parser động cho cấu trúc 2 dòng header: nhóm ngày + tên trường dữ liệu.
- Tự map học sinh khi tên chuẩn hóa khớp duy nhất; hỗ trợ mapping thủ công trên UI.
- Lưu toàn bộ ô không rỗng vào staging/audit `external_observations`.
- Materialize an toàn SCORE, skill event, ATTENDANCE và NOTE.
- Không tự tạo học sinh; không tự xóa dữ liệu nghiệp vụ; không ghi đè điểm danh nhập thủ công.
- NOTE import mặc định không hiển thị cho phụ huynh.
- Ngày tương lai hoặc trước `import_from_date` chỉ staging.

## Google Sheet hiện tại

- Spreadsheet ID: `1Pf4YrlHn-8JQIDCIjQR0Szumitn8Yt-v_QxAPF-JO_I`
- gid: `0`
- Tên file: `KHỐI 5 LÊN 6 2026 2027`

Form `/teacher/data-sources` đã prefill URL này. Giáo viên chỉ cần chọn đúng lớp trong database.

Sheet hiện có một số header ngày 2025/2027 xen giữa dữ liệu 2026 và có các vùng header merge nhiều cột. v0.20.0 không tự đoán/sửa các trường hợp không chắc chắn: dữ liệu vẫn được staging nhưng chỉ materialize khi mapping đủ an toàn.

## Upgrade Neon

Chạy trước khi deploy source:

```bash
psql "$DATABASE_URL" -f db/neon_upgrade_v0.20.0.sql
```

Hoặc dán `db/neon_upgrade_v0.20.0.sql` vào Neon SQL Editor.

Không chạy `npm run db:migrate` trên production đang có dữ liệu; `db/schema.sql` là cumulative schema dành cho fresh install/dev.

## Environment

Các biến đã được bổ sung vào `.env.example`:

```env
GOOGLE_SHEET_SYNC_ENABLED=true
GOOGLE_SHEET_SYNC_TICK_MS=60000
GOOGLE_SHEET_FETCH_TIMEOUT_MS=15000
GOOGLE_SHEET_FETCH_RETRIES=2
```

## Sử dụng

1. Đăng nhập tài khoản `TEACHER`.
2. Mở **Nguồn dữ liệu** (`/teacher/data-sources`).
3. Chọn lớp tương ứng trong database.
4. Giữ URL Google Sheet đã prefill hoặc nhập Sheet khác.
5. Lưu nguồn.
6. Mở chi tiết và chọn **Đồng bộ ngay** cho lần đầu.
7. Xử lý các học sinh chưa tự mapping nếu có.
8. Sau đó scheduler sẽ tự đồng bộ theo chu kỳ.

## CLI

Source đã đăng ký:

```bash
node scripts/google-sheet-sync-cli.js --source-id 1 --force
```

Hoặc tạo source + sync lần đầu:

```bash
node scripts/google-sheet-sync-cli.js \
  --teacher-id 1 \
  --class-id 5 \
  --url "https://docs.google.com/spreadsheets/d/1Pf4YrlHn-8JQIDCIjQR0Szumitn8Yt-v_QxAPF-JO_I/edit?gid=0#gid=0" \
  --from 2026-01-01 \
  --force
```

CLI dùng cùng `src/config/db.js` và `.env` với ứng dụng.

## Test

```bash
node --test test/google-sheet-csv.test.js test/google-sheet-integration.test.js
```

## Bảo mật

v0.20.0 dùng public Viewer CSV để triển khai nhanh. Bước hardening tiếp theo nên dùng Google Service Account read-only rồi chuyển Google Sheet về **Private**; parser/staging/materialization không cần thay đổi.
