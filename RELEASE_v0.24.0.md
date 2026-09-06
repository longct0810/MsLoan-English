# English Classroom v0.24.0

**Username Authentication + Student Code + Tuition Transfer Code**

Baseline: **v0.23.1**.

## Breaking change

Từ v0.24.0, đăng nhập sử dụng **Tên tài khoản (username)** thay cho email. Vì source mới truy vấn `users.username`, phải chạy migration v0.24.0 **trước khi restart ứng dụng**.

## Quy ước mới

- Username: 3–50 ký tự, lowercase, `a-z 0-9 . _ -`.
- Student code: `Y{6|7|8|9}_HS{student_id}`.
- Tuition transfer code: `HP YYYYMM {student_code}`.

Ví dụ:

```text
Student ID: 9
Grade: 6
Student code: Y6_HS9
Kỳ 09/2026: HP 202609 Y6_HS9
```

Email cũ không bị xóa; chỉ không còn dùng để đăng nhập.
