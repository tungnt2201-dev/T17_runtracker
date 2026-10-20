/* T17 RunTracker — hộp thoại trong app (thay prompt()).
 * Mọi hàm trả về Promise; huỷ → null.
 *   uiPrompt({title, message, value, placeholder})                 → string | null
 *   uiDateRange({title, message, from, to})                        → {from, to} | null
 *   uiChoose({title, message, options:[{label, sub, value}]})      → value | null
 *   uiDates({title, message, suggestions:[ymd]})                   → [ymd] | null
 */
(function (root) {
'use strict';
const q = (f, n) => f.querySelector(`[name="${n}"]`);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function open({ title, message = '', body, okLabel = 'Đồng ý', wide = false, collect, onReady }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal show ui-dialog';
    wrap.innerHTML = `<div class="sheet ui-dialog-sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><div class="sheet-head"><h2>${esc(title)}</h2>${message ? `<div class="meta">${esc(message)}</div>` : ''}</div><form class="sheet-body">${body}<div class="ui-dialog-error" hidden></div><div class="sheetactions"><button type="button" data-ui-cancel>Huỷ</button><button type="submit" class="primary">${esc(okLabel)}</button></div></form></div>`;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form'), err = wrap.querySelector('.ui-dialog-error');
    const done = v => { document.removeEventListener('keydown', onKey, true); wrap.remove(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) done(null); });
    wrap.querySelector('[data-ui-cancel]').onclick = () => done(null);
    form.onsubmit = e => { e.preventDefault(); try { done(collect(form)); } catch (ex) { err.hidden = false; err.textContent = ex.message || String(ex); } };
    onReady && onReady(form, done);
    const first = form.querySelector('input,select,button[data-choice]'); if (first) setTimeout(() => { first.focus(); first.select && first.select(); }, 0);
  });
}

function uiPrompt({ title, message, value = '', placeholder = '', okLabel = 'Lưu', required = true } = {}) {
  return open({ title, message, okLabel, body: `<div class="field"><input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" /></div>`,
    collect: f => { const v = q(f, 'v').value.trim(); if (required && !v) throw new Error('Chưa nhập nội dung.'); return v; } });
}

function uiDateRange({ title = 'Chọn khoảng ngày', message = 'Để trống = không giới hạn', from = '', to = '', okLabel = 'Xuất file' } = {}) {
  const today = new Date(); const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const back = n => { const d = new Date(today); d.setDate(d.getDate() - n); return ymd(d); };
  return open({ title, message, okLabel,
    body: `<div class="grid"><div class="field"><label>Từ ngày</label><input type="date" name="from" value="${esc(from)}" /></div><div class="field"><label>Đến ngày</label><input type="date" name="to" value="${esc(to)}" /></div></div>
      <div class="ui-quick"><span>Nhanh:</span><button type="button" data-r="all">Tất cả</button><button type="button" data-r="28">4 tuần</button><button type="button" data-r="91">3 tháng</button><button type="button" data-r="365">12 tháng</button><button type="button" data-r="future">Từ hôm nay</button></div>`,
    onReady: f => f.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { const r = b.dataset.r; if (r === 'all') { q(f, 'from').value = ''; q(f, 'to').value = ''; } else if (r === 'future') { q(f, 'from').value = ymd(today); q(f, 'to').value = ''; } else { q(f, 'from').value = back(+r); q(f, 'to').value = ymd(today); } }),
    collect: f => { const a = q(f, 'from').value, b = q(f, 'to').value; if (a && b && a > b) throw new Error('"Từ ngày" phải trước "Đến ngày".'); return { from: a, to: b }; } });
}

function uiChoose({ title, message, options = [] } = {}) {
  const body = `<div class="ui-choices">${options.map((o, i) => `<button type="button" class="ui-choice" data-choice="${i}"><b>${esc(o.label)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
  return open({ title, message, body, okLabel: 'Chọn',
    onReady: (f, done) => { f.querySelector('button[type=submit]').hidden = true; f.querySelectorAll('[data-choice]').forEach(b => b.onclick = () => done(options[+b.dataset.choice].value)); },
    collect: () => null });
}

function uiDates({ title, message, suggestions = [], okLabel = 'Copy' } = {}) {
  const chips = new Set(suggestions.filter(Boolean));
  return open({ title, message, okLabel, wide: true,
    body: `<div class="ui-dates-row"><input type="date" name="pick" /><button type="button" data-add>＋ Thêm ngày</button><button type="button" data-step="7">+1 tuần</button><button type="button" data-step="14">+2 tuần</button></div><div class="ui-chips" data-chips></div>`,
    onReady: f => {
      const host = f.querySelector('[data-chips]');
      const draw = () => { host.innerHTML = chips.size ? [...chips].sort().map(d => `<span class="ui-chip">${esc(d.split('-').reverse().join('/'))}<button type="button" data-del="${d}" title="Bỏ">×</button></span>`).join('') : '<span class="ui-muted">Chưa chọn ngày nào.</span>'; host.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { chips.delete(b.dataset.del); draw(); }); };
      const last = () => [...chips].sort().pop() || suggestions[0];
      f.querySelector('[data-add]').onclick = () => { if (q(f, 'pick').value) { chips.add(q(f, 'pick').value); draw(); } };
      q(f, 'pick').addEventListener('change', () => { if (q(f, 'pick').value) { chips.add(q(f, 'pick').value); draw(); } });
      f.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { const base = last(); if (!base) return; const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + +b.dataset.step); chips.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); draw(); });
      draw();
    },
    collect: () => { if (!chips.size) throw new Error('Hãy chọn ít nhất một ngày.'); return [...chips].sort(); } });
}

root.T17UI = { uiPrompt, uiDateRange, uiChoose, uiDates };
})(typeof globalThis !== 'undefined' ? globalThis : this);
