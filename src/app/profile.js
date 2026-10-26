/* T17 RunTracker — hộp thoại Hồ sơ VĐV (db.profile), xem trước vùng HR / pace khi nhập. */
(function (root) {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PERSONAL_IDS = { fullName: 'pfFullName', nickname: 'pfNickname', birthDate: 'pfBirth', heightCm: 'pfHeight', email: 'pfEmail', phone: 'pfPhone', city: 'pfCity', club: 'pfClub', emergencyName: 'pfEmName', emergencyPhone: 'pfEmPhone', goal: 'pfGoal', notes: 'pfNotes' };
function readPersonal() { const o = {}; for (const [k, id] of Object.entries(PERSONAL_IDS)) o[k] = $(id).value; return o; }
function readForm() {
  return { sex: $('pfSex').value, hrRest: $('pfHrRest').value.trim(), hrMax: $('pfHrMax').value.trim(), lthr: $('pfLthr').value.trim(), thresholdPace: $('pfPace').value.trim(), weightKg: $('pfWeight').value.trim() };
}
function preview() {
  headPreview();
  const A = root.T17Athlete, draft = readForm(), P = A.resolveProfile(draft);
  const paceOk = !draft.thresholdPace || root.T17Core.paceToSec(draft.thresholdPace) > 0;
  $('pfPace').classList.toggle('input-error', !paceOk);
  const est = P.estimated.map(k => ({ hrMax: `HR tối đa ≈ ${P.hrMax}`, hrRest: `HR nghỉ ≈ ${P.hrRest}`, lthr: `LTHR ≈ ${P.lthr}` })[k]);
  $('pfNote').innerHTML = est.length ? `Đang dùng giá trị ước tính: ${esc(est.join(' · '))}. Nhập số đo thật để vùng tập và điểm tải chính xác hơn.` : 'Đủ thông số nhịp tim.';
  $('pfHrZones').innerHTML = `<table class="an-table"><tbody>${A.hrZoneTable(draft).map(z => `<tr><td>${esc(z.name)}</td><td>${z.from}–${z.to} bpm</td></tr>`).join('')}</tbody></table>`;
  const pz = A.paceZoneTable(draft);
  $('pfPaceZones').innerHTML = pz.length ? `<table class="an-table"><tbody>${pz.map(z => `<tr><td>${esc(z.name)}</td><td>${esc(z.label)}</td></tr>`).join('')}</tbody></table>` : '<div class="an-empty">Nhập pace ngưỡng để xem vùng pace.</div>';
  return paceOk;
}
function headPreview() {
  const Us = root.T17Users, per = readPersonal(), merged = Us.mergePersonal({ sex: $('pfSex').value, weightKg: $('pfWeight').value, hrMax: $('pfHrMax').value, hrRest: $('pfHrRest').value, lthr: $('pfLthr').value, thresholdPace: $('pfPace').value }, per);
  const name = Us.displayName(merged, root.T17Platform.activeUser().name), age = Us.ageFromBirth(merged.birthDate), bmi = Us.bmi(merged.heightCm, $('pfWeight').value);
  $('pfAvatar').textContent = Us.initials(name); $('pfAvatar').style.background = Us.colorFor(root.T17Platform.activeUserId());
  $('pfHeadName').textContent = name; $('pfHeadSub').textContent = [age ? age + ' tuổi' : '', merged.city, merged.club].filter(Boolean).join(' · ');
  $('pfAge').textContent = age ? `${age} tuổi` : ''; $('pfBmi').textContent = bmi ? `BMI ≈ ${bmi}` : '';
  const c = Us.completeness(merged); $('pfProgressBar').style.width = Math.round(100 * c.filled / c.total) + '%'; $('pfProgressTxt').textContent = `Đã nhập ${c.filled}/${c.total} mục chính`;
  const sa = $('pfSuggestAge'), sug = Us.suggestHrMaxByAge(age); sa.hidden = !sug || !!$('pfHrMax').value; if (sug) { sa.textContent = `Ước tính theo tuổi: ${sug} bpm`; sa.onclick = () => { $('pfHrMax').value = sug; preview(); }; }
}
function open() {
  const p = db.profile || {}; $('pfTitle').textContent = 'Hồ sơ — ' + root.T17Platform.activeUser().name;
  for (const [k, id] of Object.entries(PERSONAL_IDS)) $(id).value = p[k] ?? '';
  $('pfSex').value = p.sex === 'female' ? 'female' : 'male';
  $('pfHrRest').value = p.hrRest ?? ''; $('pfHrMax').value = p.hrMax ?? ''; $('pfLthr').value = p.lthr ?? ''; $('pfPace').value = p.thresholdPace ?? ''; $('pfWeight').value = p.weightKg ?? '';
  const sug = root.T17Athlete.suggestHrMax(db), sb = $('pfSuggestMax');
  sb.hidden = !sug; if (sug) { sb.textContent = `Dùng HR cao nhất từ FIT: ${sug} bpm`; sb.onclick = () => { $('pfHrMax').value = sug; preview(); }; }
  preview(); $('profileModal').classList.add('show');
}
function close() { $('profileModal').classList.remove('show'); }
function init() {
  ['pfSex', 'pfHrRest', 'pfHrMax', 'pfLthr', 'pfPace', 'pfWeight', ...Object.values(PERSONAL_IDS)].forEach(id => $(id).addEventListener('input', preview));
  $('pfCancel').onclick = close;
  $('profileModal').addEventListener('mousedown', e => { if (e.target === $('profileModal')) close(); });
  $('profileForm').onsubmit = e => {
    e.preventDefault(); if (!preview()) return alert('Pace ngưỡng chưa đúng dạng mm:ss, ví dụ 5:10.');
    const f = readForm(), n = v => v === '' ? '' : Number(String(v).replace(',', '.'));
    if (f.hrMax && f.hrRest && +f.hrMax <= +f.hrRest + 20) return alert('HR tối đa phải lớn hơn HR nghỉ ít nhất 20 bpm.');
    db.profile = root.T17Users.mergePersonal({ ...(db.profile || {}), sex: f.sex, hrRest: n(f.hrRest), hrMax: n(f.hrMax), lthr: n(f.lthr), thresholdPace: f.thresholdPace ? root.T17Core.secToPace(root.T17Core.paceToSec(f.thresholdPace)) : '', weightKg: n(f.weightKg), updatedAt: new Date().toISOString() }, readPersonal());
    if (root.T17UserUI) root.T17UserUI.syncName();
    saveDb(); close(); refreshViews(); render({ preserveScroll: true }); toast('Đã lưu hồ sơ — điểm tải được tính lại');
  };
  const rail = $('railProfile'); if (rail) rail.onclick = open;
}
root.T17Profile = { open, close, init };
})(typeof globalThis !== 'undefined' ? globalThis : this);
