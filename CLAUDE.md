# T17 RunTracker — ghi chú cho người phát triển

- Giao diện và thông báo bằng **tiếng Việt**.
- Mọi file trong `src/` là classic script (IIFE, gắn vào `globalThis`); `scripts/build.mjs` nhúng chúng theo thứ tự `MODULES`. Thêm module mới thì thêm vào cả `MODULES` lẫn `scripts/check-syntax.mjs`.
- Logic thuần (không DOM) đặt trong `src/core/` và phải có test trong `tests/` (`node:test`, không thêm framework).
- **Không phá tương thích dữ liệu**: mọi thay đổi schema đi qua `src/core/legacy.js` (`normalizeDb`), tăng `SCHEMA_VERSION`, thêm fixture cũ vào `tests/fixtures/`. File sao lưu luôn giữ mảng `weeks` ở cấp cao nhất.
- Lưu dữ liệu chỉ qua `saveDb()` → `T17Platform.save()`; tham chiếu bài theo `id` (`resolveRef`), không tin chỉ số `wi/di/ii`.
- Giữ exe nhỏ: không dùng Electron hay thư viện UI nặng.
- Kiểm tra trước khi đẩy: `npm run check && npm test`.
- Phát hành: tăng `version` trong `package.json` + ghi CHANGELOG; Actions tự tạo Release `yymmdd_T17_runtracker_vX.Y.Z.zip`.
- **Nhiều người dùng**: `db` luôn là dữ liệu của MỘT người dùng; mọi đường lưu/nạp đi qua `T17Platform` (theo `activeUserId`). Không tự ghép đường dẫn file dữ liệu; dùng `T17Users.fileNameFor/lsKeyFor`. Người dùng `main` giữ file/khoá đời cũ.
