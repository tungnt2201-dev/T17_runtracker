/* T17 RunTracker — hồ sơ vận động viên & vùng tập.
 * db.profile = { sex, hrMax, hrRest, lthr, thresholdPace ("mm:ss"/km), weightKg, updatedAt }
 * Pure — dùng trong app (globalThis.T17Athlete) và Node test.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { paceToSec, secToPace } = C;

const HR_ZONES = [ // % LTHR (mô hình 5 vùng kiểu Friel cho chạy bộ)
  { id: 1, name: 'Z1 · Hồi phục', to: 0.85 },
  { id: 2, name: 'Z2 · Aerobic', to: 0.90 },
  { id: 3, name: 'Z3 · Tempo', to: 0.95 },
  { id: 4, name: 'Z4 · Ngưỡng', to: 1.00 },
  { id: 5, name: 'Z5 · VO2max+', to: Infinity },
];
const PACE_ZONES = [ // tỷ lệ (thời gian/km) so với pace ngưỡng; >1 = chậm hơn ngưỡng
  { id: 1, name: 'Z1 · Hồi phục', slowerThan: 1.29 },
  { id: 2, name: 'Z2 · Aerobic', slowerThan: 1.14 },
  { id: 3, name: 'Z3 · Tempo', slowerThan: 1.06 },
  { id: 4, name: 'Z4 · Ngưỡng', slowerThan: 0.99 },
  { id: 5, name: 'Z5 · VO2max+', slowerThan: 0 },
];

function num(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; }

/** Chuẩn hoá hồ sơ; điền giá trị ước tính khi thiếu (đánh dấu trong `estimated`). */
function resolveProfile(p) {
  p = p && typeof p === 'object' ? p : {};
  const out = { sex: p.sex === 'female' ? 'female' : 'male', hrMax: num(p.hrMax), hrRest: num(p.hrRest), lthr: num(p.lthr), thresholdPaceSec: paceToSec(p.thresholdPace), weightKg: num(p.weightKg), estimated: [] };
  if (!out.hrRest) { out.hrRest = 60; out.estimated.push('hrRest'); }
  if (!out.hrMax) { out.hrMax = 190; out.estimated.push('hrMax'); }
  if (out.hrMax <= out.hrRest + 20) { out.hrMax = out.hrRest + 100; out.estimated.push('hrMax'); }
  if (!out.lthr) { out.lthr = Math.round(out.hrRest + 0.85 * (out.hrMax - out.hrRest)); out.estimated.push('lthr'); }
  out.complete = !out.estimated.length && out.thresholdPaceSec > 0;
  return out;
}

function hrZoneTable(prof) {
  const P = resolveProfile(prof); let from = 0;
  return HR_ZONES.map(z => { const lo = from, hi = z.to === Infinity ? P.hrMax : Math.round(P.lthr * z.to) - 1; from = hi + 1; return { ...z, from: Math.round(lo), to: hi }; });
}
function hrZoneOf(hr, prof) {
  const P = resolveProfile(prof); const r = hr / P.lthr;
  for (const z of HR_ZONES) if (r < z.to) return z.id;
  return 5;
}
function paceZoneTable(prof) {
  const P = resolveProfile(prof); if (!P.thresholdPaceSec) return [];
  let slowEdge = Infinity;
  return PACE_ZONES.map(z => { const fast = z.slowerThan ? P.thresholdPaceSec * z.slowerThan : 0; const row = { ...z, fastSec: fast, slowSec: slowEdge, label: `${fast ? secToPace(fast) : '…'} – ${slowEdge === Infinity ? '…' : secToPace(slowEdge)}/km` }; slowEdge = fast; return row; });
}
function paceZoneOf(paceSec, prof) {
  const P = resolveProfile(prof); if (!P.thresholdPaceSec || !(paceSec > 0)) return 0;
  const r = paceSec / P.thresholdPaceSec;
  for (const z of PACE_ZONES) if (r > z.slowerThan) return z.id;
  return 5;
}

/** Gợi ý HR max = nhịp tim cao nhất từng ghi nhận trong các buổi FIT (lọc nhiễu: ≤ 225). */
function suggestHrMax(db) {
  let best = 0;
  for (const w of db?.weeks || []) for (const d of w.days || []) for (const it of d.workouts || []) {
    const a = it.actual; if (!a) continue;
    const m = Number(a.maxHr) || Number(a.fitImport?.insights?.stats?.maxHr) || 0;
    if (m > best && m <= 225) best = m;
  }
  return best ? Math.round(best) : 0;
}

const api = { HR_ZONES, PACE_ZONES, resolveProfile, hrZoneTable, hrZoneOf, paceZoneTable, paceZoneOf, suggestHrMax };
root.T17Athlete = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
