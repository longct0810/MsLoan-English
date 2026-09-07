# English Classroom v0.24.1

**Shared Parent Account Integrity**

Baseline: **v0.24.0**.

Bản hotfix này chuẩn hóa trường hợp một phụ huynh có nhiều con đang học trong hệ thống. `parent_students` tiếp tục là quan hệ many-to-many; một `users` role `PARENT` được dùng chung cho nhiều học viên.

Không có thay đổi schema database. Chỉ cần deploy source và restart PM2.
