# Tích hợp patch v0.20.0 vào source v0.19.1

Patch được viết dạng factory để không giả định sai đường dẫn `pool` và middleware của source hiện tại.

## A. Mount route

Trong nơi khởi tạo Express app/server, thêm tương đương:

```js
const { createGoogleSheetModule } = require('./src/modules/data-sources');
const { startGoogleSheetSyncJob } = require('./src/jobs/google-sheet-sync.job');

// Dùng chính pg Pool đang có của v0.19.1.
// const pool = require('./src/config/database'); // ví dụ, thay bằng export thực tế

// Dùng chính middleware auth/RBAC của v0.19.1.
// requireAuth: bắt buộc đã đăng nhập.
// requireTeacher: chỉ TEACHER (hoặc ADMIN nếu policy hiện tại cho phép).
const googleSheetModule = createGoogleSheetModule({
  pool,
  logger: console,
  requireAuth,
  requireTeacher,
});

app.use('/teacher/data-sources', googleSheetModule.router);

const stopGoogleSheetJob = startGoogleSheetSyncJob(googleSheetModule.service, {
  logger: console,
});
```

**Không mount route nếu chưa truyền `requireAuth` và `requireTeacher`.** Module sẽ throw để tránh vô tình mở dữ liệu học sinh ra public.

Nếu app có graceful shutdown:

```js
process.on('SIGTERM', () => {
  stopGoogleSheetJob();
});
```

## B. CSRF

Form EJS dùng biến `csrfToken` nếu app đã expose qua `res.locals`. Hãy giữ nguyên middleware CSRF hiện tại của v0.19.1 cho toàn bộ POST:

```text
POST /teacher/data-sources
POST /teacher/data-sources/:id/sync
POST /teacher/data-sources/:id/student-links
```

Không whitelist các endpoint này khỏi CSRF.

## C. Menu giáo viên

Thêm link vào menu teacher hiện tại:

```html
<a href="/teacher/data-sources">Nguồn dữ liệu</a>
```

Đặt dưới nhóm Quản lý/Báo cáo là phù hợp.

## D. Version

Sau khi merge patch vào source thật:

```json
{
  "version": "0.20.0"
}
```

Giữ cơ chế v0.19.1 đang dùng để hiển thị version trên navbar/footer/health.

## E. PM2 cluster

Có thể bật scheduler trên mọi instance. `pg_try_advisory_xact_lock()` bảo vệ phần ghi DB nên không duplicate. Instance thua lock ghi run `LOCKED` rồi bỏ qua.

Nếu muốn giảm cả request tải Sheet dư thừa, có thể chỉ bật `GOOGLE_SHEET_SYNC_ENABLED=true` trên một worker/job process; không bắt buộc.

## F. Chính sách materialize v0.20.0

- SCORE -> `student_scores`; nếu nhận dạng skill -> `student_skill_events(source_type='EXTERNAL')`.
- ATTENDANCE -> `session_attendance`; không overwrite record `MANUAL`.
- NOTE -> `teacher_notes`, luôn private với phụ huynh mặc định.
- LEVEL -> staging `external_observations`.
- HOMEWORK_STATUS -> staging `external_observations`.
- TEXT -> staging `external_observations`.

Việc chưa materialize LEVEL/HOMEWORK là chủ ý để tránh tạo dữ liệu nghiệp vụ sai khi chưa có mapping rõ `assignment_id`/mô hình CEFR chính thức.
