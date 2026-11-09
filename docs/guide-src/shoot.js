// Chụp toàn bộ màn hình cho Hướng dẫn sử dụng.
'use strict';
const path = require('path');
const fs = require('fs');
const chromium = require('../shot/node_modules/@sparticuz/chromium');
const puppeteer = require('../shot/node_modules/puppeteer-core');
const { make } = require('./sample-data.js');
const C = require('/home/claude/T17_runtracker/src/core/utils.js');
const OUT = path.join(__dirname, 'img'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8765/T17_runtracker.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = C.ymd(new Date());

(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--font-render-hinting=none'], headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 } });
  const errs = [];
  const newPage = async (data) => {
    const page = await browser.newPage();
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.evaluateOnNewDocument(d => { try { if (d) localStorage.setItem('runplan-tracker-v1', d); else localStorage.clear(); } catch (e) {} }, data ? JSON.stringify(data) : '');
    await page.goto(URL); await sleep(700);
    return page;
  };
  const shot = async (page, name, sel, pad = 0) => {
    const file = path.join(OUT, name + '.png');
    if (!sel) { await page.screenshot({ path: file }); return; }
    const el = await page.$(sel); if (!el) throw new Error('Không thấy ' + sel);
    await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(150);
    if (!pad) { await el.screenshot({ path: file }); return; }
    const b = await el.boundingBox(); await page.screenshot({ path: file, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } });
  };
  const full = async (page, name, modalSel) => {
    await page.setViewport({ width: 1440, height: 3200, deviceScaleFactor: 1.5 });
    await page.addStyleTag({ content: '.sheet{max-height:none!important;overflow:visible!important}.modal{align-items:flex-start!important;overflow:visible!important}' }).then(h => page._t17 = h);
    await sleep(300);
    await shot(page, name, modalSel + ' .sheet');
    await page.evaluate(() => { document.querySelectorAll('style').forEach(st => { if (st.textContent.startsWith('.sheet{max-height:none')) st.remove(); }); });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 }); await sleep(200);
  };
  const click = async (page, sel) => { await page.click(sel); await sleep(250); };

  /* ---------- 1. Lần đầu mở app (chưa có dữ liệu) ---------- */
  let p = await newPage(null);
  await shot(p, '01_man_hinh_dau');
  await shot(p, '02_thanh_cong_cu', 'header.app-top');
  await click(p, '#newWorkoutBtn');
  await shot(p, '03_builder_trong', '#builderModal .sheet');
  await p.close();

  /* ---------- 2. Dữ liệu mẫu ---------- */
  const data = make(today);
  for (const w of data.weeks) for (const d of w.days) if (d.date === C.addDaysYmd(today, -3)) for (const it of d.workouts) it.actual = null;
  p = await newPage(data);
  await shot(p, '04_lich_tuan');
  await shot(p, '05_thanh_ben_trai', 'aside.rail');
  await shot(p, '06_tong_quan_tuan', 'aside.summary');
  // thẻ bài đã có kết quả
  await click(p, '#prevWeek'); await sleep(300);
  const doneDate = await p.evaluate(t => { let best = ''; for (const w of db.weeks) for (const d of w.days) if (d.date < t && d.workouts.some(x => x.actual && x.actual.status === 'done' && x.workoutType === 'Tempo')) best = d.date; return best; }, today);
  await p.evaluate(dd => { currentWeek = db.weeks.findIndex(w => w.days.some(d => d.date === dd)); render(); }, doneDate); await sleep(300);
  await shot(p, '07_the_bai_da_tap', `section.day-col[data-daycol-date="${doneDate}"] .workout-card`, 4);
  await click(p, '#todayBtn'); await sleep(300);
  await shot(p, '08_the_bai_ke_hoach', `section.day-col[data-daycol-date="${C.addDaysYmd(today, 2)}"] .workout-card`, 4);

  // Builder bài Interval (sửa bài hôm nay)
  await p.evaluate(t => { const loc = locateDate(t); openBuilder(t, { wi: loc.wi, di: loc.di, ii: 0 }); }, today);
  await sleep(300);
  await full(p, '09_builder_interval', '#builderModal');
  await click(p, '#cancelBuilder');

  // Thư viện
  await click(p, '#libraryBtn');
  await shot(p, '11_thu_vien', '#libraryModal .sheet');
  await click(p, '#closeLibrary');

  // Nhập kết quả tay
  await p.evaluate(t => { const loc = locateDate(t); openModal(loc.wi, loc.di, 0); }, doneDate);
  await sleep(300);
  await full(p, '12_nhap_ket_qua', '#modal');
  await click(p, '#cancelModal');

  // Import 1 file FIT (Interval hôm nay)
  const fitIn = await p.$('#fitImportFile');
  await fitIn.uploadFile(path.join(__dirname, 'fit', '2026-10-21-interval.fit')); await sleep(900);
  await p.evaluate(() => { const s = document.getElementById('fitTargetWorkout'); const o = [...s.options].find(x => x.value !== '__new__'); if (o) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(500);
  await full(p, '14_fit_xem_truoc', '#fitImportModal');
  await click(p, '#fitApplyBtn'); await sleep(500);
  await shot(p, '17_the_bai_sau_fit', `section.day-col[data-daycol-date="${today}"] .workout-card`, 4);
  await p.evaluate(t => { const loc = locateDate(t); openModal(loc.wi, loc.di, 0); }, today); await sleep(400);
  await shot(p, '18_ket_qua_co_fit', '#modal .sheet');
  await p.evaluate(() => { const d = document.getElementById('fitSavedDetails'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } document.getElementById('fitSavedOpenNow')?.click(); }); await sleep(700);
  await full(p, '19_phan_tich_fit_da_luu', '#modal');
  await click(p, '#cancelModal');

  // Import nhiều FIT
  const fitIn2 = await p.$('#fitImportFile');
  await fitIn2.uploadFile(path.join(__dirname, 'fit', '2026-10-20-easy.fit'), path.join(__dirname, 'fit', '2026-10-18-long.fit')); await sleep(1500);
  await shot(p, '20_fit_nhieu_file', '#fitBatchModal .sheet');
  await click(p, '#fitBatchCloseBtn'); await sleep(400);
  await shot(p, '21_the_fit_tim', `section.day-col[data-daycol-date="${C.addDaysYmd(today, -1)}"] .workout-card`, 4);
  await p.evaluate(() => { currentWeek = Math.max(0, currentWeek - 1); render(); }); await sleep(300);
  await shot(p, '21b_the_long_run_fit', `section.day-col[data-daycol-date="${C.addDaysYmd(today, -3)}"] .workout-card`, 4);
  await click(p, '#todayBtn');

  // Copy bài
  await p.evaluate(t => { const col = document.querySelector(`section.day-col[data-daycol-date="${t}"]`); col.querySelector('[data-copy-wi]').click(); }, C.addDaysYmd(today, 2)); await sleep(300);
  await p.evaluate(() => document.querySelector('.ui-dialog [data-step="7"]').click()); await sleep(150);
  await shot(p, '22_copy_bai', '.ui-dialog .sheet');
  await p.keyboard.press('Escape'); await sleep(150);

  // Menu Dữ liệu
  await p.evaluate(() => { document.getElementById('dataMenu').open = true; }); await sleep(200);
  const mb = await p.$('#dataMenu'); const panel = await p.$('#dataMenu .menu-panel');
  const b1 = await mb.boundingBox(), b2 = await panel.boundingBox();
  await p.screenshot({ path: path.join(OUT, '23_menu_du_lieu.png'), clip: { x: b2.x - 10, y: b1.y - 6, width: b2.width + 20, height: b2.y + b2.height - b1.y + 16 } });
  await p.evaluate(() => { document.getElementById('dataMenu').open = false; });

  // Chọn khoảng ngày khi xuất Excel
  p.evaluate(() => exportExcel()); await sleep(300);
  await p.evaluate(() => document.querySelector('.ui-dialog [data-r="91"]').click()); await sleep(100);
  await shot(p, '24_chon_khoang_ngay', '.ui-dialog .sheet');
  await p.keyboard.press('Escape'); await sleep(150);

  // Training Log
  await click(p, '#tabLog'); await sleep(300);
  await shot(p, '25_training_log');
  await click(p, '#tabCalendar');

  // Hồ sơ VĐV
  await click(p, '#railProfile');
  for (const [id, v] of [['#pfHrRest', '50'], ['#pfHrMax', '186'], ['#pfLthr', '168'], ['#pfPace', '5:20'], ['#pfWeight', '64']]) { await p.click(id, { clickCount: 3 }); await p.type(id, v); }
  await sleep(200);
  await shot(p, '26_ho_so_vdv', '#profileModal .sheet');
  await p.click('#profileForm button[type=submit]'); await sleep(500);

  // Analytics
  await click(p, '#tabAnalytics'); await sleep(500);
  await shot(p, '27_analytics_tren');
  const pmc = await (await p.$('#anPmc')).boundingBox();
  await p.mouse.move(pmc.x + pmc.width * 0.62, pmc.y + pmc.height * 0.5); await sleep(200);
  await p.screenshot({ path: path.join(OUT, '28_analytics_tooltip.png'), clip: { x: pmc.x - 20, y: pmc.y - 50, width: pmc.width + 40, height: pmc.height + 60 } });
  await p.mouse.move(5, 5);
  await p.evaluate(() => { const b = document.getElementById('anBody'); b.scrollTo(0, b.scrollHeight); }); await sleep(250);
  await shot(p, '29_analytics_duoi');

  // Nút Garmin trên thẻ + thông báo
  await click(p, '#tabCalendar'); await sleep(300);
  await p.evaluate(t => { const col = document.querySelector(`section.day-col[data-daycol-date="${t}"]`); col.scrollIntoView({ block: 'center' }); }, C.addDaysYmd(today, 2)); await sleep(200);
  const card = await p.$(`section.day-col[data-daycol-date="${C.addDaysYmd(today, 2)}"] .workout-card`);
  const cb = await card.boundingBox();
  await p.screenshot({ path: path.join(OUT, '30_nut_tren_the.png'), clip: { x: cb.x - 6, y: cb.y - 6, width: cb.width + 12, height: Math.min(160, cb.height) + 12 } });
  await p.evaluate(t => document.querySelector(`section.day-col[data-daycol-date="${t}"] [data-garmin-wi]`).click(), C.addDaysYmd(today, 2)); await sleep(400);
  await shot(p, '31_thong_bao_garmin', '#toast', 10);

  await p.close(); await browser.close();
  console.log('Lỗi trang:', errs.length ? errs : 'không');
  console.log(fs.readdirSync(OUT).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });
