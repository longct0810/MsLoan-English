-- English Classroom v0.25.0
-- Google Sheets Schema Profiles & Dry-run Validation
-- Baseline: v0.24.3
-- No new tables/columns: profile is stored in external_data_sources.settings JSONB.

BEGIN;

UPDATE external_data_sources
   SET settings = jsonb_set(
         jsonb_set(
           COALESCE(settings, '{}'::jsonb),
           '{sheet_profile}',
           CASE
             WHEN jsonb_typeof(COALESCE(settings, '{}'::jsonb)->'sheet_profile') = 'object'
               THEN COALESCE(settings, '{}'::jsonb)->'sheet_profile'
             ELSE jsonb_build_object(
               'version', 1,
               'mode', 'AUTO',
               'confirmed', FALSE,
               'attendance_aliases', jsonb_build_array(),
               'column_overrides', '{}'::jsonb
             )
           END,
           TRUE
         ),
         '{require_confirmed_sheet_profile}',
         'true'::jsonb,
         TRUE
       ),
       last_content_hash = NULL,
       updated_at = NOW()
 WHERE provider = 'GOOGLE_SHEETS';

COMMIT;

-- Sau migration, vào từng nguồn Google Sheets:
-- Nguồn dữ liệu -> Cấu hình & Dry-run -> kiểm tra số học viên/điểm danh/điểm -> tick Xác nhận -> Lưu.
-- Khi chưa xác nhận, scheduler/manual sync vẫn staging nhưng KHÔNG materialize vào bảng nghiệp vụ.
