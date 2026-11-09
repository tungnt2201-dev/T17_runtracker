# T17 RunTracker — ghi chú cho người phát triển

- Giao diện và thông báo bằng **tiếng Việt**.
- Mọi file trong `src/` là classic script (IIFE, gắn vào `globalThis`); `scripts/build.mjs` nhúng chúng theo thứ tự `MODULES`. Thêm module mới thì thêm vào cả `MODULES` lẫn `scripts/check-syntax.mjs`.
- Logic thuần (không DOM) đặt trong `src/core/` và phải có test trong `tests/` (`node:test`, không thêm framework).
- **Không phá tương thích dữ liệu**: mọi thay đổi schema đi qua `src/core/legacy.js` (`normalizeDb`), thêm fixture cũ vào `tests/fixtures/`. File sao lưu luôn giữ mảng `weeks` ở cấp cao nhất.
  - Thay đổi **cộng thêm, tuỳ chọn** → KHÔNG tăng `SCHEMA_VERSION` (bản cũ tự ghi đè về 2); đánh dấu bằng `db.features` (`featuresOf`). Chỉ tăng khi thay đổi không cộng thêm.
  - File chỉ có chạy bộ không được thêm field mới; bản ghi chạy bộ khi xuất giữ đúng bộ trường cũ (`planRecord`).
  - `tests/compat.test.js` so với lõi nguyên văn `tests/compat/v2.2.0/` (không sửa thư mục đó) — phải luôn xanh.
- Fitness UI ở `src/app/fitness-ui.js` (`T17FitnessUI`); thẻ, nút ✎ và ⋮ của bài fitness phải đi qua `T17FitnessUI` (không mở Workout Builder / hộp kết quả chạy bộ). FIT chạy bộ không được ghép vào bài fitness (`isFitnessWorkout`). Mẫu fitness nằm trong `db.templates` (`workoutType: 'Fitness'`) — tab Bài chạy phải lọc ra.
- Mọi nút / đường nhập file phải cho file đi qua `T17FitnessImportUI.takeFitnessFiles(files)` trước (tách file app fitness → hộp xem trước), phần còn lại mới vào luồng cũ. Logic nhập thuần ở `src/core/fitness-import.js`.
- `instanceId` bài trong buổi T17 = `<sessionId>:<k>` — không đổi quy ước này (app mobile chỉ giữ instanceId).
- Fitness: logic trong `src/core/fitness.js`; bài fitness có `description` = `summaryText` để bản cũ đọc được; ảnh/hướng dẫn chỉ nằm trong `fitnessLibrary`. Copy/thêm từ mẫu phải cấp `sessionId` mới.
- Lưu dữ liệu chỉ qua `saveDb()` → `T17Platform.save()`; tham chiếu bài theo `id` (`resolveRef`), không tin chỉ số `wi/di/ii`.
- Giữ exe nhỏ: không dùng Electron hay thư viện UI nặng.
- Kiểm tra trước khi đẩy: `npm run check && npm test`.
- Phát hành: tăng `version` trong `package.json` + ghi CHANGELOG; Actions tự tạo Release `yymmdd_T17_runtracker_vX.Y.Z.zip`.
- **Nhiều người dùng**: `db` luôn là dữ liệu của MỘT người dùng; mọi đường lưu/nạp đi qua `T17Platform` (theo `activeUserId`). Không tự ghép đường dẫn file dữ liệu; dùng `T17Users.fileNameFor/lsKeyFor`. Người dùng `main` giữ file/khoá đời cũ.
