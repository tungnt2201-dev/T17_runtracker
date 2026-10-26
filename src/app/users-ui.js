/* T17 RunTracker — giao diện nhiều người dùng: nút ở thanh trên, danh sách, thêm / đổi tên / xoá / chuyển.
 * Mỗi người dùng có kho dữ liệu riêng (xem core/users.js, platform.js). Dùng các biến toàn cục của app.js (db, render…). */
(function (root) {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = () => root.T17Users, P = () => root.T17Platform;
let busy = false;

function labelOf(u) { return u.id === P().activeUserId() && db.profile ? U().displayName(db.profile, u.name) : u.name; }
function avatarHtml(u, cls = '') { const n = labelOf(u); return `<span class="avatar ${cls}" style="background:${U().colorFor(u.id)}">${esc(U().initials(n))}</span>`; }

function renderChip() {
  const act = P().activeUser(), name = labelOf(act);
  const av = $('userAvatar'); av.textContent = U().initials(name); av.style.background = U().colorFor(act.id);
  $('userChipName').textContent = name;
  $('userList').innerHTML = P().listUsers().map(u => `<button type="button" class="user-item${u.id === act.id ? ' active' : ''}" data-id="${esc(u.id)}">${avatarHtml(u)}<span class="user-item-name">${esc(labelOf(u))}</span>${u.id === act.id ? '<span class="user-item-check">✓</span>' : ''}</button>`).join('');
  $('userList').querySelectorAll('.user-item').forEach(b => b.onclick = () => { closeMenu(); switchTo(b.dataset.id); });
  $('userDeleteBtn').hidden = P().listUsers().length < 2;
}
function openMenu() { renderChip(); $('userMenu').hidden = false; $('userChip').setAttribute('aria-expanded', 'true'); }
function closeMenu() { $('userMenu').hidden = true; $('userChip').setAttribute('aria-expanded', 'false'); }

/** Đồng bộ tên trong danh sách với "tên gọi / họ tên" trong hồ sơ. */
function syncName() {
  const act = P().activeUser(), nm = U().displayName(db.profile, act.name);
  if (nm && nm !== act.name) P().renameUser(act.id, nm);
  renderChip();
}

function closeOpenModals() { document.querySelectorAll('.modal.show:not(.ui-dialog)').forEach(m => m.classList.remove('show')); }
/** Nạp dữ liệu thô của người dùng vào app và vẽ lại toàn bộ màn hình. */
function applyRaw(raw) {
  const { db: loaded, report } = loadDbFrom(raw); db = loaded;
  saveDb(); // người dùng mới → tạo file; dữ liệu cũ → nâng schema
  closeOpenModals();
  editingKey = null; builderEditing = null; builderState = null; visibleWeekCount = 6;
  switchView('calendar'); currentWeek = findCurrentWeek(); render(); refreshViews();
  return report;
}
async function switchTo(id) {
  if (busy || id === P().activeUserId()) return;
  busy = true;
  try {
    await P().flush();
    const raw = await P().switchUser(id);
    applyRaw(raw === undefined ? null : raw);
    renderChip();
    const nm = labelOf(P().activeUser());
    toast(`Đang dùng hồ sơ: ${nm}`);
  } catch (e) { alert('Không chuyển được người dùng: ' + (e.message || e)); } finally { busy = false; }
}
async function addUser() {
  closeMenu();
  const name = await root.T17UI.uiPrompt({ title: 'Thêm người dùng', message: 'Người mới có lịch tập, kết quả và hồ sơ riêng. Các thông tin khác nhập bổ sung sau trong Hồ sơ.', placeholder: 'Tên người dùng, vd. Lan', okLabel: 'Tạo & chuyển sang' });
  if (!name) return;
  try {
    await P().flush();
    const u = await P().createUser(name);
    await switchTo(u.id);
    if (P().activeUserId() === u.id) { db.profile = { ...(db.profile || {}), fullName: name }; saveDb(); syncName(); root.T17Profile.open(); }
  } catch (e) { alert(e.message || e); }
}
async function deleteUser() {
  closeMenu();
  const users = P().listUsers(), act = P().activeUser();
  if (users.length < 2) return;
  const target = await root.T17UI.uiChoose({ title: 'Xoá người dùng nào?', message: 'Chọn người cần xoá (không xoá được người đang dùng).', options: users.filter(u => u.id !== act.id).map(u => ({ label: u.name, sub: 'Dữ liệu được chuyển vào thư mục data\\deleted (bản .exe)', value: u.id })) });
  if (!target) return;
  const victim = users.find(u => u.id === target);
  const typed = await root.T17UI.uiPrompt({ title: `Xoá “${victim.name}”?`, message: 'Toàn bộ kế hoạch, kết quả và hồ sơ của người này sẽ bị xoá khỏi danh sách. Gõ đúng tên để xác nhận.', placeholder: victim.name, okLabel: 'Xoá' });
  if (typed == null) return;
  if (typed.trim().toLowerCase() !== victim.name.toLowerCase()) return alert('Tên nhập không khớp — chưa xoá.');
  try { await P().removeUser(victim.id); renderChip(); toast(`Đã xoá người dùng ${victim.name}`); } catch (e) { alert(e.message || e); }
}

function init() {
  $('userChip').onclick = e => { e.stopPropagation(); $('userMenu').hidden ? openMenu() : closeMenu(); };
  document.addEventListener('mousedown', e => { if (!$('userMenu').hidden && !$('userWrap').contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('userMenu').hidden) closeMenu(); });
  $('userAddBtn').onclick = addUser; $('userDeleteBtn').onclick = deleteUser;
  $('userProfileBtn').onclick = () => { closeMenu(); root.T17Profile.open(); };
  renderChip();
}
root.T17UserUI = { init, renderChip, syncName, switchTo, applyRaw };
})(typeof globalThis !== 'undefined' ? globalThis : this);
