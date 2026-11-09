/* Bộ điều khiển E2E — CHỈ nhúng vào bản chạy thử (scripts/e2e-exe.mjs), KHÔNG có trong bản phát hành.
 * Chạy bên trong exe Neutralino thật: thao tác qua chính các hàm của app, ghi kết quả ra e2e-result.json rồi thoát. */
(function () {
  const log = [], R = { steps: log, ok: true };
  const step = (name, ok, info) => { log.push({ name, ok: !!ok, info: info == null ? '' : String(info) }); if (!ok) R.ok = false; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (fn()) return true; } catch (e) { /* chưa sẵn */ } await wait(50); } return false; };
  window.confirm = () => true; window.alert = m => log.push({ name: 'alert', ok: true, info: String(m).slice(0, 300) });
  const autoDialogs = setInterval(() => { for (const d of document.querySelectorAll('.ui-dialog')) { const f = d.querySelector('form'); if (f && !f.dataset.e2e) { f.dataset.e2e = '1'; f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); } } }, 60);
  const count = () => db.weeks.flatMap(w => w.days).flatMap(d => d.workouts || []).length;
  const fsx = Neutralino.filesystem, join = (...p) => p.join('/');
  async function run() {
    const t0 = performance.now();
    await until(() => typeof db !== 'undefined' && document.querySelector('.week-block'), 60000);
    R.bootMs = Math.round(performance.now() - t0);
    const cfg = JSON.parse(await fsx.readFile(join(NL_PATH, 'e2e-config.json')));
    const dataDir = T17Platform.status.dataDir; R.dataDir = dataDir;
    step('Khởi động exe, mở đúng người dùng đang chọn và dữ liệu có sẵn', count() === cfg.expectBoot && T17Platform.activeUserId() === cfg.expectBootUser, `${T17Platform.activeUserId()}: ${count()} bài (mong đợi ${cfg.expectBoot}), ${R.bootMs} ms`);
    if (cfg.mode === 'perf') {
      let t = performance.now(); render(); R.renderMs = Math.round(performance.now() - t);
      t = performance.now(); saveDb(); await T17Platform.flush(); R.saveMs = Math.round(performance.now() - t);
      document.getElementById('tabAnalytics').click(); await wait(50);
      t = performance.now(); T17Analytics.render(); R.analytics12Ms = Math.round(performance.now() - t);
      document.querySelector('#anRange [data-weeks="0"]').click(); t = performance.now(); T17Analytics.render(); R.analyticsAllMs = Math.round(performance.now() - t);
      document.querySelector('#anSub [data-sub="body"]').click(); t = performance.now(); T17Analytics.render(); R.bodyAllMs = Math.round(performance.now() - t);
      const st = await fsx.getStats(join(dataDir, 't17-runtracker.json')); R.fileMB = +(st.size / 1048576).toFixed(2);
      step('Đo hiệu năng dữ liệu 3 năm', true, JSON.stringify({ boot: R.bootMs, render: R.renderMs, save: R.saveMs, a12: R.analytics12Ms, aAll: R.analyticsAllMs, body: R.bodyAllMs, fileMB: R.fileMB }));
      return;
    }
    // 1. người dùng mới + chuyển người dùng
    const u = await T17Platform.createUser('E2E Tester'); await T17UserUI.switchTo(u.id); await wait(300);
    step('Tạo và chuyển sang người dùng mới', T17Platform.activeUserId() === u.id && count() === 0, `id ${u.id}, ${count()} bài`);
    // 2. nhập file app fitness (qua hộp xem trước)
    const v3 = JSON.parse(await fsx.readFile(join(NL_PATH, 'e2e-fitness-v3.json')));
    await T17FitnessImportUI.importSources([{ name: 'fitness-v3.json', data: v3 }]); await until(() => count() > 0, 8000);
    const fit = db.weeks.flatMap(w => w.days).flatMap(d => d.workouts || []).find(x => T17Fitness.isFitnessWorkout(x));
    step('Nhập buổi fitness từ app mobile', !!fit && !!fit.actual, fit ? `${fit.workoutName}, ${fit.fitness.exercises.length} bài tập` : 'không thấy');
    // 3. chỉ số cơ thể từ CSV + hồ sơ để tính calo
    db.profile = { ...(db.profile || {}), sex: 'male', heightCm: '172', birthDate: '1988-05-20' }; saveDb();
    await T17BodyUI.importCsvText(await fsx.readFile(join(NL_PATH, 'e2e-body.csv')), 'body.csv'); await wait(400);
    const nBody = (db.bodyMetrics || []).length;
    step('Nhập chỉ số cơ thể (CSV)', nBody >= 3, `${nBody} lần đo`);
    const d = T17Energy.day(db, fit.__date || db.weeks.flatMap(w => w.days).find(x => (x.workouts || []).includes(fit)).date);
    step('Tính calo ngày có buổi fitness', d.ok && d.exerciseKcal > 0, `nền ${Math.round(d.baseline.kcal || 0)} + tập ${Math.round(d.exerciseKcal)}`);
    await T17Platform.flush();
    const userFile = join(dataDir, T17Users.fileNameFor(u.id));
    let onDisk = null; try { onDisk = JSON.parse(await fsx.readFile(userFile)); } catch (e) { /* */ }
    step('Dữ liệu người dùng mới ghi ra file riêng', onDisk && onDisk.bodyMetrics?.length === nBody && onDisk.weeks.length > 0, userFile);
    // 4. sao lưu (thay hộp thoại Lưu của hệ điều hành bằng đường dẫn cố định)
    const backupPath = join(NL_PATH, 'e2e-backup.json'); Neutralino.os.showSaveDialog = async () => backupPath;
    backup(); await wait(1500); let bk = null; try { bk = JSON.parse(await fsx.readFile(backupPath)); } catch (e) { /* */ }
    step('Sao lưu ra file JSON', bk && bk.bodyMetrics?.length === nBody && bk.weeks.flatMap(w => w.days).flatMap(x => x.workouts).length === count(), backupPath);
    // 5. về người dùng chính, dữ liệu không lẫn
    await T17UserUI.switchTo('main'); await wait(400);
    step('Chuyển về người dùng chính, dữ liệu không lẫn', count() === cfg.expectMainWorkouts && !(db.bodyMetrics || []).length, `${count()} bài`);
    // 6. khôi phục bản sao lưu vào người dùng chính (có bản dự phòng trước khi ghi đè)
    await restoreFromData(bk, 'e2e-backup.json'); await T17Platform.flush(); await wait(300);
    const backups = (await fsx.readDirectory(join(dataDir, 'backups'))).map(x => x.entry);
    step('Khôi phục vào người dùng chính', count() === bk.weeks.flatMap(w => w.days).flatMap(x => x.workouts).length && db.bodyMetrics.length === nBody, `${count()} bài, ${db.bodyMetrics.length} số đo`);
    step('Có bản dự phòng trước khi khôi phục', backups.some(x => /truoc-khoi-phuc/.test(x)), backups.filter(x => /truoc/.test(x)).join(', '));
    const mainDisk = JSON.parse(await fsx.readFile(join(dataDir, 't17-runtracker.json')));
    step('File người dùng chính trên đĩa đúng nội dung mới', mainDisk.bodyMetrics?.length === nBody, '');
    // 7. chuyển qua lại thêm một vòng
    await T17UserUI.switchTo(u.id); await wait(300); const a = count(); await T17UserUI.switchTo('main'); await wait(300);
    step('Chuyển qua lại giữa hai người dùng', a > 0 && count() > 0 && T17Platform.activeUserId() === 'main', `${a} / ${count()}`);
  }
  run().catch(e => step('LỖI', false, e && (e.stack || e.message) || e)).finally(async () => {
    clearInterval(autoDialogs);
    try { await Neutralino.filesystem.writeFile(NL_PATH + '/e2e-result.json', JSON.stringify(R, null, 2)); } catch (e) { /* */ }
    try { await T17Platform.flush(); } catch (e) { /* */ } Neutralino.app.exit();
  });
})();
