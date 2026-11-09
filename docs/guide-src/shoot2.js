// Chụp màn hình cho các chương mới (người dùng, Fitness, cơ thể, calo). Dữ liệu mẫu hư cấu.
'use strict';
const path = require('path'), fs = require('fs');
const chromium = require('../shot/node_modules/@sparticuz/chromium');
const puppeteer = require('../shot/node_modules/puppeteer-core');
const { make2, mobileFiles } = require('./sample-data2.js');
const C = require('/home/claude/T17_runtracker/src/core/utils.js');
const OUT = path.join(__dirname, 'img'); fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:8765/T17_runtracker.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = C.ymd(new Date());
(async () => {
  const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args, '--font-render-hinting=none'], headless: true, defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1.5 } });
  const errs = [];
  const data = make2(today);
  const mfiles = mobileFiles(data, today).map(([n, o]) => { const f = path.join(__dirname, 'mobile-' + n); fs.writeFileSync(f, JSON.stringify(o)); return f; });
  const page = await browser.newPage();
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.evaluateOnNewDocument(d => { try { if (!localStorage.getItem('__seeded')) { localStorage.clear(); localStorage.setItem('runplan-tracker-v1', d); localStorage.setItem('__seeded', '1'); } } catch (e) {} }, JSON.stringify(data));
  await page.goto(URL); await sleep(900);
  const p = page;
  const file = n => path.join(OUT, n + '.png');
  const shot = async (name, sel, pad = 0) => {
    const el = await p.$(sel); if (!el) throw new Error('Không thấy ' + sel);
    await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(150);
    if (!pad) return el.screenshot({ path: file(name) });
    const b = await el.boundingBox(); await p.screenshot({ path: file(name), clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: b.width + pad * 2, height: b.height + pad * 2 } });
  };
  const full = async (name, modalSel) => {
    await p.setViewport({ width: 1440, height: 3600, deviceScaleFactor: 1.5 });
    await p.addStyleTag({ content: '.sheet{max-height:none!important;overflow:visible!important}.modal{align-items:flex-start!important;overflow:visible!important}' });
    await sleep(300); await shot(name, modalSel + ' .sheet');
    await p.evaluate(() => { document.querySelectorAll('style').forEach(st => { if (st.textContent.startsWith('.sheet{max-height:none')) st.remove(); }); });
    await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 }); await sleep(200);
  };
  const click = async sel => { await p.click(sel); await sleep(300); };
  const submit = async () => { await p.evaluate(() => document.querySelector('.ui-dialog form').requestSubmit()); await sleep(400); };
  const esc = async () => { await p.keyboard.press('Escape'); await sleep(200); };

  /* ---- Nhiều người dùng ---- */
  await shot('40_thanh_tren_nguoi_dung', 'header.app-top');
  await click('#userChip'); await sleep(200);
  await shot('40b_menu_nguoi_dung', '#userMenu', 12);
  await click('#userAddBtn'); await p.type('.ui-dialog input[name=v]', 'Bảo Ngọc'); await sleep(150);
  await shot('41_them_nguoi_dung', '.ui-dialog .sheet');
  await submit(); await sleep(900);                       // chuyển sang người mới + mở hồ sơ
  await full('42_ho_so_nguoi_moi', '#profileModal');
  await p.evaluate(() => document.getElementById('pfCancel').click()); await sleep(300);
  await shot('43_lich_nguoi_moi', 'body');               // lịch trống của người mới
  await click('#userChip'); await sleep(200);
  await shot('43b_menu_hai_nguoi', '#userMenu', 12);
  await p.evaluate(() => document.querySelector('#userList [data-id="main"]').click()); await sleep(1200);

  /* ---- Hồ sơ cá nhân (người chính) ---- */
  await click('#railProfile'); await sleep(400);
  await full('44_ho_so_day_du', '#profileModal');
  await p.evaluate(() => document.getElementById('pfEnSection').scrollIntoView({ block: 'center' })); await sleep(200);
  await p.evaluate(() => document.getElementById('pfCancel').click()); await sleep(300);

  /* ---- Fitness ---- */
  await click('#libraryBtn'); await click('[data-libtab="fitness"]'); await sleep(300);
  await shot('50_thu_vien_fitness', '#libraryModal .sheet');
  p.evaluate(() => { T17FitnessUI.editExercise(''); }); await sleep(400);
  await p.type('.ui-dialog input[name=name]', 'Goblet squat'); await p.type('.ui-dialog input[name=category]', 'Chân / mông'); await p.type('.ui-dialog input[name=plan]', '3 x 12'); await sleep(150);
  await shot('51_sua_bai_tap', '.ui-dialog .sheet'); await esc();
  p.evaluate(() => { T17FitnessUI.assignDialog('b:' + T17Fitness.BUILTIN_TEMPLATES[0].id); }); await sleep(400);
  await shot('52_giao_bai', '.ui-dialog .sheet'); await esc();
  await click('#closeLibrary');
  // thẻ fitness trong lịch: tuần hiện tại cuối tuần trước
  await p.evaluate(() => { const t = document.querySelector('article.workout-card.fitness'); });
  const planDate = C.addDaysYmd(today, -1);
  await p.evaluate(d => { currentWeek = db.weeks.findIndex(w => w.days.some(x => x.date === d)); render(); }, planDate); await sleep(300);
  await shot('53_the_fitness_ke_hoach', `section.day-col[data-daycol-date="${planDate}"] .workout-card`, 4);
  const doneDate = await p.evaluate(t => { let b = ''; for (const w of db.weeks) for (const d of w.days) if (d.date < t && d.workouts.some(x => x.workoutType === 'Fitness' && x.actual)) b = d.date; return b; }, today);
  await p.evaluate(d => { currentWeek = db.weeks.findIndex(w => w.days.some(x => x.date === d)); render(); }, doneDate); await sleep(300);
  await shot('53b_the_fitness_da_tap', `section.day-col[data-daycol-date="${doneDate}"] .workout-card.fitness`, 4);
  p.evaluate(d => { const l = locateDate(d); T17FitnessUI.openResult({ wi: l.wi, di: l.di, ii: 0 }); }, planDate); await sleep(500);
  await full('54_nhap_ket_qua_fitness', '.ui-dialog');
  await esc();
  // nhập từ app mobile
  const inp = await p.$('#importFile'); await inp.uploadFile(mfiles[0]); await sleep(1500);
  await full('55_import_mobile_xem_truoc', '.ui-dialog');
  await esc();
  p.evaluate(d => { const l = locateDate(d); T17FitnessUI.exportMobile({ wi: l.wi, di: l.di, ii: 0 }); }, planDate); await sleep(400);
  await shot('56_xuat_mobile', '.ui-dialog .sheet'); await esc();

  /* ---- Chỉ số cơ thể ---- */
  await p.evaluate(() => { currentWeek = findCurrentWeek(); render(); });
  await click('#railBody'); await sleep(500);
  await full('60_chi_so_co_the', '#bodyModal');
  await click('#bdAdd'); await sleep(400);
  await p.type('.ui-dialog input[name=weightKg]', '67,6'); await p.type('.ui-dialog input[name=bodyFatPct]', '19,6'); await p.type('.ui-dialog input[name=waistCm]', '81,8'); await sleep(200);
  await full('61_nhap_so_do', '.ui-dialog');
  await esc(); await click('#bdClose');
  await click('#tabAnalytics'); await sleep(500);
  await p.evaluate(() => T17Analytics.setSubTab('body')); await sleep(600);
  await p.screenshot({ path: file('62_analytics_co_the') });
  await p.evaluate(() => { const b = document.getElementById('anBody'); b.scrollTo(0, b.scrollHeight); }); await sleep(300);
  await p.screenshot({ path: file('63_so_sanh_hai_moc') });

  /* ---- Calo ---- */
  await p.evaluate(() => T17Analytics.setSubTab('training')); await sleep(500);
  await p.evaluate(() => { const b = document.getElementById('anBody'); b.scrollTo(0, 0); }); await sleep(200);
  await shot('74_analytics_calo', '#anEnergy', 8);
  await click('#tabCalendar'); await sleep(300);
  await p.evaluate(() => { currentWeek = findCurrentWeek(); render(); }); await sleep(400);
  await shot('70_calo_tren_lich', `section.day-col[data-daycol-date="${C.addDaysYmd(today, 0)}"]`, 0);
  await shot('72_the_calo_tuan', '#energyCard', 6);
  await p.evaluate(d => T17EnergyUI.openDay(d), C.addDaysYmd(today, -3)); await sleep(500);
  await shot('71_chi_tiet_ngay', '#energyDayModal .sheet');
  await p.type('#enDayInput', '2400'); await sleep(100);
  await shot('71b_sua_nen_ngay', '#energyDayModal .sheet');
  await p.evaluate(() => document.getElementById('enDayClose').click()); await sleep(200);
  await click('#railProfile'); await sleep(300);
  await p.evaluate(() => document.getElementById('pfEnSection').scrollIntoView({ block: 'start' })); await sleep(200);
  await p.screenshot({ path: file('73_ho_so_nang_luong') });
  await browser.close();
  console.log('Lỗi trang:', errs.length ? errs : 'không');
})().catch(e => { console.error(e); process.exit(1); });
