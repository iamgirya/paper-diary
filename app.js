'use strict';
/* Бумажный дневник: неделя на одном развороте.
   Пн–Ср слева, Чт–Сб справа, воскресенье — полоса внизу на всю ширину.
   Все координаты записей хранятся в «клетках», поэтому раскладка масштабируется вместе с экраном. */

const KEY = 'paperDiary.v1';
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MOODS = ['😄', '🙂', '😌', '😐', '😕', '😢', '😡', '😴', '🤒', '🥳', '😍', '🤯'];
const INKS = ['#1f2c80', '#222222', '#b3322b', '#2e7a3e', '#7a3fa3'];
const FONTS = { Caveat: 'Caveat', Neucha: 'Neucha' };
const HEADER_CELLS = 2;
const WEEK_CELLS = 42;          // 7 частей по 6 клеток
const ROW = 12, SUN = 6;
const LH = 1.15;                // line-height записи

const $ = (s) => document.querySelector(s);
const pageEl = $('#page'), weekEl = $('#week'), toolbar = $('#toolbar'), moodPicker = $('#moodPicker'), menu = $('#menu');

/* ---------- данные ---------- */
function emptyDb() { return { version: 1, days: {}, settings: { font: 'Caveat', size: 1.3, ink: INKS[0], lastExport: Date.now() } }; }
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.days) { d.settings = Object.assign(emptyDb().settings, d.settings || {}); return d; }
  } catch (e) { console.error(e); }
  return emptyDb();
}
let db = load();
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

function dayData(k, create) {
  if (!db.days[k] && create) db.days[k] = { notes: [] };
  const d = db.days[k];
  if (d && !d.notes) d.notes = [];
  return d;
}
function prune() {
  for (const k of Object.keys(db.days)) {
    const d = db.days[k];
    d.notes = (d.notes || []).filter((n) => n.text && n.text.trim());
    if (!d.notes.length && !d.mood) delete db.days[k];
  }
}
let saveTimer = 0;
function save(now) {
  clearTimeout(saveTimer);
  if (now) return flush();
  saveTimer = setTimeout(flush, 300);
}
function cleanDays() {
  const out = {};
  for (const [k, d] of Object.entries(db.days)) {
    const notes = (d.notes || []).filter((n) => n.text && n.text.trim()).map((n) => Object.assign({}, n));
    if (notes.length || d.mood) out[k] = d.mood ? { mood: d.mood, notes } : { notes };
  }
  return out;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ version: 1, days: cleanDays(), settings: db.settings })); return true; }
  catch (e) { toast('Не удалось сохранить: ' + e.message); return false; }
}
function flush() {
  saveTimer = 0;
  persist();
  scheduleBackup();
}

/* ---------- даты ---------- */
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };

// Последняя недозаполненная неделя: неделя дня, следующего за последним заполненным (но не позже сегодня).
function startWeek() {
  const t = today(), tk = keyOf(t);
  const filled = Object.keys(db.days).filter((k) => k <= tk && (db.days[k].notes || []).some((n) => n.text && n.text.trim())).sort();
  if (!filled.length) return mondayOf(t);
  const next = addDays(parseKey(filled[filled.length - 1]), 1);
  return mondayOf(next > t ? t : next);
}

function rangeLabel(mon) {
  const sun = addDays(mon, 6);
  const a = mon.getDate(), b = sun.getDate();
  if (mon.getFullYear() !== sun.getFullYear())
    return `${a} ${MONTHS[mon.getMonth()]} ${mon.getFullYear()} — ${b} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
  if (mon.getMonth() !== sun.getMonth())
    return `${a} ${MONTHS[mon.getMonth()]} — ${b} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
  return `${a} — ${b} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
}

/* ---------- раскладка ---------- */
let cell = 24, cols = 60, monday = startWeek();

function layout() {
  const H = window.innerHeight, W = window.innerWidth;
  cell = H / (HEADER_CELLS + WEEK_CELLS);
  cols = Math.max(20, Math.floor(W / cell));
  document.documentElement.style.setProperty('--cell', cell + 'px');
  pageEl.style.width = cols * cell + 'px';
  pageEl.style.height = H + 'px';
  weekEl.style.height = WEEK_CELLS * cell + 'px';
  const half = Math.floor(cols / 2);
  weekEl.querySelectorAll('.day').forEach((el) => {
    const i = +el.dataset.i;
    let l, t, w, h;
    if (i < 3) { l = 0; t = i * ROW; w = half; h = ROW; }
    else if (i < 6) { l = half; t = (i - 3) * ROW; w = cols - half; h = ROW; }
    else { l = 0; t = 3 * ROW; w = cols; h = SUN; }
    Object.assign(el.style, { left: l * cell + 'px', top: t * cell + 'px', width: w * cell + 'px', height: h * cell + 'px' });
  });
  placeToolbar();
}

function render() {
  closePopups();
  weekEl.textContent = '';
  $('#range').textContent = rangeLabel(monday);
  const tk = keyOf(today());
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i), k = keyOf(date);
    const el = document.createElement('section');
    el.className = 'day' + (i >= 3 && i < 6 ? ' col1' : '') + (i === 6 ? ' sun' : '') + (k === tk ? ' today' : '');
    el.dataset.i = i; el.dataset.key = k;
    el.title = '';
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = date.getDate();
    if (date.getDate() === 1) {
      const m = document.createElement('span'); m.className = 'month'; m.textContent = MONTHS[date.getMonth()];
      num.appendChild(m);
    }
    el.appendChild(num);
    const mood = document.createElement('button');
    mood.className = 'mood';
    mood.title = 'Настроение дня';
    const d = dayData(k);
    if (d && d.mood) { mood.textContent = d.mood; mood.classList.add('set'); }
    el.appendChild(mood);
    if (d) for (const n of d.notes) el.appendChild(noteEl(n));
    weekEl.appendChild(el);
  }
  layout();
}

function go(m) { if (active) active.el.blur(); monday = mondayOf(m); render(); }

/* ---------- записи ---------- */
let active = null; // { key, n, el }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const r2 = (v) => Math.round(v * 100) / 100;

function styleNote(el, n) {
  el.style.left = `calc(var(--cell) * ${n.x})`;
  el.style.top = `calc(var(--cell) * ${n.y})`;
  el.style.fontSize = `calc(var(--cell) * ${n.size})`;
  el.style.transform = n.rot ? `rotate(${n.rot}deg)` : '';
  el.style.color = n.ink || '';
}
function noteEl(n) {
  const el = document.createElement('div');
  el.className = 'note';
  el.contentEditable = 'plaintext-only';
  el.spellcheck = false;
  el.dataset.id = n.id;
  el.textContent = n.text;
  styleNote(el, n);
  return el;
}
function findNote(el) {
  const day = el.closest('.day'); if (!day) return null;
  const k = day.dataset.key, d = dayData(k); if (!d) return null;
  const n = d.notes.find((x) => x.id === el.dataset.id);
  return n ? { key: k, n, el } : null;
}
function removeNote(a) {
  const d = dayData(a.key);
  if (d) d.notes = d.notes.filter((x) => x !== a.n);
  a.el.remove();
  if (active && active.n === a.n) { active = null; toolbar.classList.add('hidden'); }
  save();
}

weekEl.addEventListener('mousedown', (e) => {
  const day = e.target.closest('.day');
  if (!day || e.button !== 0) return;
  if (e.target.closest('.mood')) return;
  const noteTarget = e.target.closest('.note');
  if (noteTarget) {
    if (e.altKey) { e.preventDefault(); const a = findNote(noteTarget); if (a) { noteTarget.focus(); startDrag(e, a); } }
    return;
  }
  // клик в пустое место — новая запись прямо здесь
  e.preventDefault();
  closePopups();
  const r = day.getBoundingClientRect();
  const size = db.settings.size;
  const n = {
    id: uid(),
    x: r2((e.clientX - r.left) / cell - 0.1),
    y: r2((e.clientY - r.top) / cell - (size * LH) / 2),
    size, rot: 0, ink: db.settings.ink, text: '',
  };
  dayData(day.dataset.key, true).notes.push(n);
  const el = noteEl(n);
  day.appendChild(el);
  el.focus();
});

weekEl.addEventListener('focusin', (e) => {
  const el = e.target.closest('.note'); if (!el) return;
  const a = findNote(el); if (!a) return;
  active = a;
  el.classList.add('active');
  syncToolbar();
});
weekEl.addEventListener('focusout', (e) => {
  const el = e.target.closest('.note'); if (!el) return;
  el.classList.remove('active');
  const a = findNote(el);
  if (a && !a.n.text.trim()) removeNote(a);
  if (active && active.el === el) { active = null; toolbar.classList.add('hidden'); }
  save();
});
weekEl.addEventListener('input', (e) => {
  const el = e.target.closest('.note'); if (!el) return;
  const a = findNote(el); if (!a) return;
  let t = el.innerText;
  if (t.endsWith('\n') && !el.textContent.endsWith('\n')) t = t.slice(0, -1);
  a.n.text = t;
  placeToolbar();
  save();
});

/* размер / поворот / цвет */
function resize(a, dir) {
  const s = a.n.size, step = s < 1.5 ? 0.1 : s < 3 ? 0.2 : 0.4;
  a.n.size = r2(Math.min(8, Math.max(0.5, s + dir * step)));
  db.settings.size = a.n.size;
  styleNote(a.el, a.n); placeToolbar(); save();
}
function rotate(a, deg) {
  let r = (a.n.rot || 0) + deg;
  r = ((r + 180) % 360 + 360) % 360 - 180;
  a.n.rot = Math.round(r);
  styleNote(a.el, a.n); placeToolbar(); save();
}

window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.altKey) return;
  e.preventDefault();
  const el = e.target.closest && e.target.closest('.note');
  const a = el ? findNote(el) : active;
  if (!a) return;
  const delta = e.deltaY || e.deltaX;
  if (!delta) return;
  if (e.ctrlKey) resize(a, delta < 0 ? 1 : -1);
  else rotate(a, (delta < 0 ? -1 : 1) * (e.shiftKey ? 1 : 5));
}, { passive: false });

/* перетаскивание — в том числе в другой день */
function startDrag(e, a) {
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY, ox = a.n.x, oy = a.n.y;
  a.el.classList.add('dragging');
  const move = (ev) => {
    a.n.x = r2(ox + (ev.clientX - sx) / cell);
    a.n.y = r2(oy + (ev.clientY - sy) / cell);
    styleNote(a.el, a.n); placeToolbar();
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    a.el.classList.remove('dragging');
    const target = document.elementsFromPoint(ev.clientX, ev.clientY).find((x) => x.classList && x.classList.contains('day'));
    const from = a.el.closest('.day');
    if (target && from && target !== from) {
      const fr = from.getBoundingClientRect(), tr = target.getBoundingClientRect();
      a.n.x = r2(a.n.x + (fr.left - tr.left) / cell);
      a.n.y = r2(a.n.y + (fr.top - tr.top) / cell);
      dayData(a.key).notes = dayData(a.key).notes.filter((x) => x !== a.n);
      a.key = target.dataset.key;
      dayData(a.key, true).notes.push(a.n);
      target.appendChild(a.el);
      styleNote(a.el, a.n);
      a.el.focus();
    }
    placeToolbar(); save();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

/* панелька над активной записью */
const inksEl = toolbar.querySelector('.inks');
for (const c of INKS) {
  const b = document.createElement('button');
  b.className = 'ink'; b.dataset.ink = c; b.style.background = c; b.title = 'Цвет чернил';
  inksEl.appendChild(b);
}
toolbar.addEventListener('mousedown', (e) => e.preventDefault()); // не отнимать фокус у записи
toolbar.addEventListener('pointerdown', (e) => {
  if (e.target.dataset.act === 'move' && active) startDrag(e, active);
});
toolbar.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !active) return;
  const a = active;
  if (b.dataset.ink) { a.n.ink = db.settings.ink = b.dataset.ink; styleNote(a.el, a.n); syncToolbar(); save(); return; }
  switch (b.dataset.act) {
    case 'smaller': resize(a, -1); break;
    case 'bigger': resize(a, 1); break;
    case 'rotl': rotate(a, e.shiftKey ? -90 : -15); break;
    case 'rotr': rotate(a, e.shiftKey ? 90 : 15); break;
    case 'side': a.n.rot = a.n.rot === 0 ? -90 : a.n.rot === -90 ? 90 : 0; styleNote(a.el, a.n); placeToolbar(); save(); break;
    case 'del': removeNote(a); break;
  }
});
function syncToolbar() {
  if (!active) return;
  toolbar.classList.remove('hidden');
  inksEl.querySelectorAll('.ink').forEach((b) => b.classList.toggle('on', b.dataset.ink === (active.n.ink || INKS[0])));
  placeToolbar();
}
function placeToolbar() {
  if (!active || toolbar.classList.contains('hidden')) return;
  const r = active.el.getBoundingClientRect(), tw = toolbar.offsetWidth, th = toolbar.offsetHeight;
  let top = r.top - th - 8;
  if (top < 4) top = r.bottom + 8;
  if (top + th > window.innerHeight - 4) top = Math.max(4, r.top + 4);
  const left = Math.min(window.innerWidth - tw - 4, Math.max(4, r.left));
  toolbar.style.top = top + 'px'; toolbar.style.left = left + 'px';
}

/* ---------- настроение ---------- */
let moodKey = null;
for (const m of MOODS) {
  const b = document.createElement('button'); b.textContent = m; b.dataset.mood = m; moodPicker.appendChild(b);
}
const clr = document.createElement('button'); clr.className = 'clear'; clr.textContent = 'убрать'; clr.dataset.mood = ''; moodPicker.appendChild(clr);

weekEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.mood'); if (!btn) return;
  const k = btn.closest('.day').dataset.key;
  if (!moodPicker.classList.contains('hidden') && moodKey === k) return closePopups();
  closePopups();
  moodKey = k;
  moodPicker.classList.remove('hidden');
  const r = btn.getBoundingClientRect();
  const w = moodPicker.offsetWidth, h = moodPicker.offsetHeight;
  moodPicker.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, r.right - w)) + 'px';
  moodPicker.style.top = (r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
});
moodPicker.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !moodKey) return;
  const d = dayData(moodKey, true);
  if (b.dataset.mood) d.mood = b.dataset.mood; else delete d.mood;
  save(); closePopups();
  const btn = weekEl.querySelector(`.day[data-key="${moodKey}"] .mood`);
  if (btn) { btn.textContent = d.mood || ''; btn.classList.toggle('set', !!d.mood); }
});

function closePopups() {
  moodPicker.classList.add('hidden'); moodKey = null;
  menu.classList.add('hidden');
}
document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('#moodPicker, .mood, #menu, #menuBtn')) closePopups();
});

/* ---------- навигация ---------- */
$('#prev').onclick = () => go(addDays(monday, -7));
$('#next').onclick = () => go(addDays(monday, 7));
$('#today').onclick = () => go(today());
const jump = $('#jump');
$('#range').onclick = () => { jump.value = keyOf(monday); try { jump.showPicker(); } catch (e) { jump.click(); } };
jump.onchange = () => { if (jump.value) go(parseKey(jump.value)); };

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt') { e.preventDefault(); return; }
  const editing = !!active;
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault(); go(addDays(monday, e.key === 'ArrowLeft' ? -7 : 7)); return;
  }
  if (e.altKey && e.key === 'Home') { e.preventDefault(); go(today()); return; }
  if (e.key === 'Escape') {
    if (!$('#help').classList.contains('hidden')) return $('#help').classList.add('hidden');
    if (active) active.el.blur();
    closePopups(); return;
  }
  if (editing && e.ctrlKey && (e.key === '=' || e.key === '+' || e.key === '-')) {
    e.preventDefault(); resize(active, e.key === '-' ? -1 : 1); return;
  }
  if (!editing && (e.key === 'PageUp' || e.key === 'PageDown')) {
    e.preventDefault(); go(addDays(monday, e.key === 'PageUp' ? -7 : 7));
  }
});
document.addEventListener('keyup', (e) => { if (e.key === 'Alt') e.preventDefault(); });
document.addEventListener('keydown', (e) => document.body.classList.toggle('alt', e.altKey));
document.addEventListener('keyup', (e) => document.body.classList.toggle('alt', e.altKey));
window.addEventListener('blur', () => document.body.classList.remove('alt'));

/* ---------- меню ---------- */
$('#menuBtn').onclick = () => {
  const open = menu.classList.contains('hidden');
  closePopups();
  if (open) {
    menu.classList.remove('hidden');
    const r = $('#menuBtn').getBoundingClientRect();
    menu.style.top = r.bottom + 4 + 'px';
    menu.style.right = Math.max(4, window.innerWidth - r.right) + 'px';
  }
};
menu.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  closePopups();
  switch (b.dataset.menu) {
    case 'export': return exportJson();
    case 'import': return $('#importFile').click();
    case 'exportTxt': return exportTxt();
    case 'linkBackup': return linkBackup();
    case 'unlinkBackup': return unlinkBackup();
    case 'font': db.settings.font = db.settings.font === 'Caveat' ? 'Neucha' : 'Caveat'; applyFont(); save(); return;
    case 'fullscreen':
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
      return;
    case 'help': return $('#help').classList.remove('hidden');
    case 'close': flush(); window.close(); return toast('Закрыть окно: Alt+F4');
  }
});
$('#helpClose').onclick = () => $('#help').classList.add('hidden');
function applyFont() {
  const f = FONTS[db.settings.font] || 'Caveat';
  document.documentElement.style.setProperty('--hand', `"${f}", "Segoe Print", cursive`);
  $('#fontName').textContent = f;
}

/* ---------- экспорт / импорт ---------- */
function stamp() { const t = new Date(); return `${keyOf(t)}_${pad(t.getHours())}-${pad(t.getMinutes())}`; }
function exportPayload() {
  return JSON.stringify({ app: 'paper-diary', version: 1, exportedAt: new Date().toISOString(), days: cleanDays(), settings: db.settings }, null, 1);
}
async function saveFile(name, text, type, ext) {
  if (window.showSaveFilePicker) {
    try {
      const h = await showSaveFilePicker({ suggestedName: name, types: [{ description: type, accept: { [type]: [ext] } }] });
      const w = await h.createWritable(); await w.write(text); await w.close();
      return true;
    } catch (e) { if (e.name === 'AbortError') return false; console.warn(e); }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
async function exportJson() {
  if (await saveFile(`diary_${stamp()}.json`, exportPayload(), 'application/json', '.json')) {
    db.settings.lastExport = Date.now(); persist(); updateBackupState(); toast('Экспортировано');
  }
}
async function exportTxt() {
  const days = cleanDays(), out = [];
  for (const k of Object.keys(days).sort()) {
    const d = days[k], dt = parseKey(k);
    out.push(`${WEEKDAYS[(dt.getDay() + 6) % 7]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}${d.mood ? '  ' + d.mood : ''}`);
    const notes = [...d.notes].sort((a, b) => a.y - b.y || a.x - b.x);
    for (const n of notes) out.push(n.text.split('\n').map((l) => '    ' + l).join('\n'));
    out.push('');
  }
  if (await saveFile(`diary_${stamp()}.txt`, out.join('\r\n'), 'text/plain', '.txt')) toast('Текст сохранён');
}
$('#importFile').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); } catch (err) { return toast('Это не JSON-файл дневника'); }
  if (!data || typeof data.days !== 'object') return toast('В файле нет данных дневника');
  const n = Object.keys(data.days).length;
  const choice = await dialog(`В файле ${n} ${plural(n, 'день', 'дня', 'дней')} с записями.`, [
    ['merge', 'Объединить с текущими'], ['replace', 'Заменить всё'], ['cancel', 'Отмена']]);
  if (choice === 'cancel') return;
  if (active) active.el.blur();
  try { localStorage.setItem(KEY + '.beforeImport', JSON.stringify(db)); } catch (err) {}
  if (choice === 'replace') {
    db.days = {};
  }
  for (const [k, d] of Object.entries(data.days)) {
    if (!/^\d{4}-\d\d-\d\d$/.test(k) || !d) continue;
    const cur = dayData(k, true);
    if (d.mood) cur.mood = d.mood;
    for (const n of d.notes || []) {
      if (!n || typeof n.text !== 'string') continue;
      const clean = { id: String(n.id || uid()), x: +n.x || 0, y: +n.y || 0, size: +n.size || 1.3, rot: +n.rot || 0, ink: n.ink || INKS[0], text: n.text };
      const i = cur.notes.findIndex((x) => x.id === clean.id);
      if (i >= 0) cur.notes[i] = clean; else cur.notes.push(clean);
    }
  }
  prune(); save(true); render();
  toast(choice === 'replace' ? 'Дневник заменён данными из файла' : 'Импортировано');
};
function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }

function dialog(text, buttons) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.id = 'dlg';
    const card = document.createElement('div'); card.className = 'card';
    const p = document.createElement('p'); p.textContent = text; card.appendChild(p);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
    for (const [v, label] of buttons) {
      const b = document.createElement('button'); b.textContent = label;
      b.onclick = () => { wrap.remove(); resolve(v); };
      row.appendChild(b);
    }
    card.appendChild(row); wrap.appendChild(card); document.body.appendChild(wrap);
  });
}

/* ---------- автобэкап в файл (File System Access API) ---------- */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('paperDiary', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function kv(op, k, v) {
  const d = await idb();
  return new Promise((res, rej) => {
    const tx = d.transaction('kv', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('kv');
    const r = op === 'get' ? st.get(k) : op === 'set' ? st.put(v, k) : st.delete(k);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
let backupHandle = null, backupOk = false, backupTimer = 0;
async function initBackup() {
  try { backupHandle = await kv('get', 'backupHandle'); } catch (e) { backupHandle = null; }
  if (backupHandle) {
    try { backupOk = (await backupHandle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { backupOk = false; }
    if (backupOk) writeBackup();
  }
  updateBackupState();
}
async function linkBackup() {
  if (!window.showSaveFilePicker) return toast('Этот браузер не умеет писать в файл — используйте экспорт');
  try {
    backupHandle = await showSaveFilePicker({ suggestedName: 'diary-autobackup.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
  } catch (e) { return; }
  await kv('set', 'backupHandle', backupHandle).catch(() => {});
  backupOk = true;
  await writeBackup();
  toast('Автобэкап включён: ' + backupHandle.name);
}
async function unlinkBackup() {
  backupHandle = null; backupOk = false;
  await kv('del', 'backupHandle').catch(() => {});
  updateBackupState(); toast('Автобэкап отключён');
}
function scheduleBackup() {
  if (!backupHandle || !backupOk) return updateBackupState();
  clearTimeout(backupTimer);
  backupTimer = setTimeout(writeBackup, 1500);
}
async function writeBackup() {
  if (!backupHandle || !backupOk) return;
  try {
    const w = await backupHandle.createWritable();
    await w.write(exportPayload()); await w.close();
    db.settings.lastExport = Date.now();
    persist();
  } catch (e) {
    console.warn(e); backupOk = false; toast('Не получилось записать автобэкап');
  }
  updateBackupState();
}
function updateBackupState() {
  const b = $('#backupState');
  const hasData = Object.keys(cleanDays()).length > 0;
  const stale = Date.now() - (db.settings.lastExport || 0) > 7 * 864e5;
  if (backupHandle && !backupOk) { b.textContent = '⚠ автобэкап на паузе — включить'; b.dataset.do = 'grant'; b.classList.remove('hidden'); }
  else if (!backupHandle && hasData && stale) { b.textContent = 'давно не было бэкапа'; b.dataset.do = 'menu'; b.classList.remove('hidden'); }
  else b.classList.add('hidden');
}
$('#backupState').onclick = async () => {
  const b = $('#backupState');
  if (b.dataset.do === 'grant' && backupHandle) {
    try { backupOk = (await backupHandle.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { backupOk = false; }
    if (backupOk) { await writeBackup(); toast('Автобэкап снова пишет в ' + backupHandle.name); }
    updateBackupState();
  } else $('#menuBtn').click();
};

/* ---------- мелочи ---------- */
let toastTimer = 0;
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}
window.addEventListener('resize', layout);
window.addEventListener('beforeunload', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) flush(); });
window.addEventListener('storage', (e) => { if (e.key === KEY && !active) { db = load(); render(); } });

applyFont();
render();
initBackup();
if (!localStorage.getItem(KEY + '.seenHelp')) { $('#help').classList.remove('hidden'); localStorage.setItem(KEY + '.seenHelp', '1'); }
