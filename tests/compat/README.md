# Bản lõi cũ dùng cho test tương thích

`v2.2.0/utils.js` và `v2.2.0/legacy.js` là bản sao **nguyên văn** của `src/core/` tại tag `v2.2.0`
(`git show v2.2.0:src/core/legacy.js`). `tests/compat.test.js` nạp chúng trong một `vm` context riêng
để kiểm tra rằng file do bản mới ghi ra vẫn được bản v2.2.0 đọc mà không mất dữ liệu, và bản mới đọc
file cũ ra kết quả giống hệt bản v2.2.0.

Không sửa các file này. Khi cần thêm mốc phiên bản (ví dụ v2.3.0), tạo thư mục mới cùng cách.
