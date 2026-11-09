// Kiểm tra cú pháp mọi module (không cần trình duyệt).
import fs from 'node:fs';
import vm from 'node:vm';
const files = ['src/core/utils.js','src/core/fitness.js','src/core/body.js','src/core/legacy.js','src/core/fitness-import.js','src/core/users.js','src/core/excel-plan.js','src/core/athlete.js','src/core/load.js','src/core/fit-workout.js','src/app/dialogs.js','src/app/analytics.js','src/app/profile.js','src/app/fitness-ui.js','src/app/fitness-import-ui.js','src/app/body-ui.js','src/app/body-charts.js','src/app/users-ui.js','src/lib/xlsx.js','src/lib/fit-decoder.js','src/platform/platform.js','src/app/app.js','src/app/fit-ui.js'];
let bad = 0;
for (const f of files) { try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); console.log('ok  ', f); } catch (e) { bad++; console.error('FAIL', f, e.message); } }
process.exit(bad ? 1 : 0);
