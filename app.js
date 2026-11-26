/* =====================================================================
   VLXD Nam Sơn — tra cứu sản phẩm & tồn kho
   Không dùng thư viện. Dữ liệu: Google Sheets → Apps Script (JSON).
   ===================================================================== */
(() => {
'use strict';

const C = window.CONFIG;
const $ = sel => document.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]));
const KEY = {data: 'ns:data:v1', tab: 'ns:tab', calc: 'ns:calc'};
const saved = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* hết bộ nhớ / chế độ riêng tư */ } },
};

/* ---------- Số & định dạng ---------- */
// Đọc số kiểu Việt lẫn kiểu Anh: "2,232" → 2.232 ; "1,094.5" → 1094.5 ; "18,5 kg" → 18.5
function toNum(v) {
  if (typeof v === 'number') return v;
  const m = String(v ?? '').match(/-?\d[\d.,]*/);
  if (!m) return NaN;
  let t = m[0];
  if (t.includes(',') && t.includes('.')) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(',', '.');
  return parseFloat(t);
}
const fmt = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('vi-VN', {maximumFractionDigits: d}) : '–';
const showVal = v => typeof v === 'number' ? fmt(v, 4) : String(v);
const sizeTxt = v => String(v ?? '').replace(/\s*[x×*]\s*/gi, ' × ');
const lower = v => String(v ?? '').trim().toLowerCase();
const normalize = s => lower(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/* ---------- Ảnh ---------- */
// Nhận: ID file Drive, link Drive, hoặc link ảnh bất kỳ / đường dẫn tương đối
function imgUrl(v, w) {
  if (!v) return '';
  const s = String(v).trim();
  const drive = s.match(/(?:\/d\/|id=)([-\w]{20,})/);
  if (drive) return `https://lh3.googleusercontent.com/d/${drive[1]}=w${w}`;
  if (/^[-\w]{20,}$/.test(s)) return `https://lh3.googleusercontent.com/d/${s}=w${w}`;
  return s;
}
const MAX_PHOTOS = 7;
// Danh sách ảnh của 1 mã: ưu tiên mảng images; ô "Ảnh" có thể chứa nhiều link (xuống dòng, dấu phẩy, chấm phẩy)
function photosOf(it) {
  const raw = Array.isArray(it.images) && it.images.length ? it.images : String(it.image || '').split(/[\n,;]+|\s+(?=https?:)/);
  return raw.map(s => String(s).trim()).filter(Boolean).slice(0, MAX_PHOTOS);
}

/* ---------- Khuyến mãi ---------- */
// promoFrom / promoTo dạng "yyyy-MM-dd" (Apps Script đã chuẩn hoá). Hết hạn → coi như không có.
const pad2 = n => String(n).padStart(2, '0');
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const PROMO_ON = 'Đang khuyến mãi', PROMO_SOON = 'Sắp diễn ra';
function promoInfo(it) {
  if (!it.promo) return null;
  const t = isoToday();
  if (it.promoTo && it.promoTo < t) return null;
  const soon = !!(it.promoFrom && it.promoFrom > t);
  const period = it.promoFrom && it.promoTo ? `${dmy(it.promoFrom)} – ${dmy(it.promoTo)}`
    : it.promoTo ? `Đến hết ${dmy(it.promoTo)}` : it.promoFrom ? `Từ ${dmy(it.promoFrom)}` : 'Không giới hạn thời gian';
  let note = '';
  if (soon) { const d = daysBetween(t, it.promoFrom); note = d === 1 ? 'Bắt đầu từ ngày mai' : `Bắt đầu sau ${d} ngày`; }
  else if (it.promoTo) { const d = daysBetween(t, it.promoTo); note = d === 0 ? 'Kết thúc hôm nay' : d <= 7 ? `Còn ${d} ngày` : ''; }
  return {state: soon ? 'soon' : 'on', label: soon ? PROMO_SOON : PROMO_ON, period, note, text: String(it.promo)};
}
// Giá trị dùng để lọc: trường thường, hoặc "_promo" (trạng thái khuyến mãi)
const fieldVal = (it, k) => k === '_promo' ? (promoInfo(it)?.label || '') : String(it[k] ?? '').trim();
const filtersOf = v => [['_promo', 'Khuyến mãi'], ...v.filters];

/* ---------- Biểu tượng ---------- */
const svg = (d, size = 18, sw = 1.8) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  floor: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M10 3v6M15 9v6M8 15v6"/>',
  toilet: '<path d="M7 3h6v7H7z"/><path d="M4 10h16a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7z"/><path d="M9 17l-1 4h8l-1-4"/>',
  puzzle: '<path d="M4 7h3a1 1 0 0 0 1-1V5a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a2 2 0 0 0 0-4H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  calc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h4"/>',
  photos: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
  prev: '<path d="m15 6-6 6 6 6"/>',
  promo: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  next: '<path d="m9 6 6 6-6 6"/>',
  noPhoto: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9M3 3l18 18"/>',
};
// Huy hiệu khuyến mãi trên ảnh: hình răng cưa đỏ + icon nhãn giá
const PROMO_BADGE = (() => {
  const pts = Array.from({length: 32}, (_, i) => {
    const a = Math.PI * i / 16 - Math.PI / 2, r = i % 2 ? 20 : 24;
    return `${(24 + r * Math.cos(a)).toFixed(1)},${(24 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<span class="promo-badge" title="Đang khuyến mãi" aria-label="Đang khuyến mãi"><svg viewBox="0 0 48 48" width="46" height="46">
    <polygon points="${pts}" fill="#d32f2f" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    <g transform="translate(13 13) scale(.92)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON.promo}</g></svg></span>`;
})();
const NO_PHOTO = `<div class="no-photo">${svg(ICON.noPhoto, 28, 1.6)}<span>Chưa có ảnh</span></div>`;

/* ---------- Trạng thái ---------- */
const S = {
  data: saved.get(KEY.data),
  tab: saved.get(KEY.tab) || 'san',
  query: '',
  picked: {},          // {trường: [giá trị đã chọn]}
  sort: 'default',
  openGroup: null,
};
const section = () => S.data?.sections?.find(s => s.id === S.tab) || S.data?.sections?.[0];
const view = sec => C.VIEWS[sec?.id] || C.VIEWS.san;
const unitOf = (sec, it) => lower(it.unit || sec.unit || 'cái');

/* ---------- Tải dữ liệu ---------- */
async function fetchData() {
  if (!C.API_URL) return window.DEMO_DATA;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(C.API_URL, {cache: 'no-store'});
      const json = await res.json();      // Apps Script đôi khi trả trang lỗi HTML → json() lỗi → thử lại
      if (json.error) throw new Error(json.error);
      if (!Array.isArray(json.sections)) throw new Error('Dữ liệu trả về không đúng định dạng');
      return json;
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
}

async function load() {
  try {
    const data = await fetchData();
    S.data = data;
    saved.set(KEY.data, data);
    render();
    openFromUrl();
  } catch (err) {
    if (S.data) toast('Mất kết nối — đang xem dữ liệu đã lưu');
    else $('#cards').innerHTML = `<div class="empty">Không tải được dữ liệu.<br><small>${esc(err.message)}</small><br><br><button class="btn" data-act="reload">Thử lại</button></div>`;
  }
}

/* ---------- Lọc & sắp xếp ---------- */
function visibleItems() {
  const sec = section();
  if (!sec) return [];
  const v = view(sec);
  const words = normalize(S.query).split(/\s+/).filter(Boolean);
  let items = sec.items.filter(it => {
    for (const [k] of filtersOf(v)) if (S.picked[k]?.length && !S.picked[k].includes(fieldVal(it, k))) return false;
    if (!words.length) return true;
    const hay = normalize(v.search.map(k => it[k] ?? '').join(' ') + ' ' + (promoInfo(it)?.text || ''));
    return words.every(w => hay.includes(w));          // gõ nhiều từ: phải khớp hết, không cần dấu
  });
  const stockOf = it => toNum(it.stockM2 ?? it.stockBox);
  if (S.sort === 'default') {                          // mặc định: hàng đang khuyến mãi lên trước, rồi sắp khuyến mãi
    const rank = it => ({on: 0, soon: 1})[promoInfo(it)?.state] ?? 2;
    items = items.map((it, i) => [rank(it), i, it]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
  }
  if (S.sort === 'code') items = items.slice().sort((a, b) => String(a.code).localeCompare(String(b.code), 'vi', {numeric: true}));
  if (S.sort === 'stockDesc') items = items.slice().sort((a, b) => (stockOf(b) || -1) - (stockOf(a) || -1));
  if (S.sort === 'stockAsc') items = items.slice().sort((a, b) => (stockOf(a) ?? 1e12) - (stockOf(b) ?? 1e12));
  return items;
}

/* ---------- Vẽ giao diện ---------- */
function render() {
  const secs = S.data?.sections || [];
  if (secs.length && !secs.some(s => s.id === S.tab)) S.tab = secs[0].id;
  const name = S.data?.store || C.STORE_NAME;
  $$('.store-name').forEach(el => el.textContent = name);

  $('#tabs').innerHTML = secs.map(s => `<button type="button" class="${s.id === S.tab ? 'active' : ''}" data-tab="${esc(s.id)}">
      ${svg(ICON[view(s).icon] || ICON.box)}<span>${esc(s.title)}</span><span class="count">${s.items?.length || 0}</span></button>`).join('');

  const sec = section();
  document.title = sec ? `${sec.title} · ${name}` : name;
  $('#stamp').textContent = sec?.updated ? `Tồn kho cập nhật đến ngày ${sec.updated}` : ' ';
  renderFilters();
  renderCards();
}

function stockLevel(sec, it) {
  const n = toNum(it.stockBox);
  if (!Number.isFinite(n)) return null;
  return n <= 0 ? 'out' : n < (toNum(sec.lowStock) || 20) ? 'low' : 'ok';
}

function stockLine(sec, it) {
  const lv = stockLevel(sec, it);
  if (!lv) return '';
  if (lv === 'out') return '<span class="stock out">Hết hàng</span>';
  const m2 = toNum(it.stockM2);
  const txt = `Còn ${fmt(toNum(it.stockBox), 1)} ${unitOf(sec, it)}` + (Number.isFinite(m2) ? ` · ${fmt(m2, 1)} m²` : '');
  return `<span class="stock ${lv === 'low' ? 'low' : ''}">${lv === 'low' ? 'Sắp hết · ' : ''}${txt}</span>`;
}

function renderCards() {
  const sec = section();
  const box = $('#cards');
  if (!sec) {
    box.innerHTML = Array(8).fill('<div class="card skeleton"><div class="photo"></div><h3></h3><p></p></div>').join('');
    $('#resultCount').textContent = '';
    return;
  }
  if (sec.error) { box.innerHTML = `<div class="empty">Không đọc được tab “${esc(sec.title)}”.<br><small>${esc(sec.error)}</small></div>`; return; }
  const v = view(sec);
  const items = visibleItems();
  $('#resultCount').textContent = items.length === sec.items.length ? `${items.length} mã` : `${items.length} / ${sec.items.length} mã`;
  box.innerHTML = items.length ? items.map((it, i) => {
    const photos = photosOf(it);
    const src = imgUrl(photos[0], 500);
    const photo = src
      ? `<img src="${esc(src)}" alt="${esc(it.code)}" loading="${i < 8 ? 'eager' : 'lazy'}" decoding="async" data-fallback>`
      : NO_PHOTO;
    const pr = promoInfo(it);
    const tag = (v.badge && it[v.badge] ? `<span class="tag">${esc(it[v.badge])}</span>` : '') +
      (pr?.state === 'on' ? PROMO_BADGE : '') +
      (photos.length > 1 ? `<span class="photo-count">${svg(ICON.photos, 13, 2)}${photos.length}</span>` : '');
    const meta = [v.line2?.(it), it.size && sizeTxt(it.size)].filter(Boolean).join(' · ');
    return `<button type="button" class="card" data-code="${esc(it.code)}">
      <div class="photo">${photo}${tag}</div>
      <h3>${esc(it.code)}</h3><p class="meta">${esc(meta)}</p>
      ${pr ? `<p class="promo-line ${pr.state}">${pr.state === 'soon' ? `Từ ${esc(dmy(it.promoFrom).slice(0, 5))}: ` : ''}${esc(pr.text)}</p>` : ''}${stockLine(sec, it)}</button>`;
  }).join('') : '<div class="empty">Không có mã nào khớp.<br><br><button class="btn" data-act="resetAll">Xoá tìm kiếm & bộ lọc</button></div>';
  wireImages(box);
}

// Ảnh tải xong thì hiện mờ dần; lỗi thì thay bằng ô "Chưa có ảnh"
function wireImages(root) {
  $$('img[data-fallback]', root).forEach(im => {
    const done = () => im.classList.add('loaded');
    const fail = () => { const d = document.createElement('div'); d.innerHTML = NO_PHOTO; im.replaceWith(d.firstChild); };
    if (im.complete) im.naturalWidth ? done() : fail();
    else { im.addEventListener('load', done, {once: true}); im.addEventListener('error', fail, {once: true}); }
  });
}

const SORTS = [['default', 'Khuyến mãi trước'], ['code', 'Theo mã'], ['stockDesc', 'Tồn nhiều nhất'], ['stockAsc', 'Tồn ít nhất']];
function renderFilters() {
  const sec = section();
  const v = view(sec);
  const items = sec?.items || [];
  const count = Object.values(S.picked).reduce((n, a) => n + a.length, 0) + (S.sort !== 'default' ? 1 : 0);
  $('#filterCount').hidden = !count;
  $('#filterCount').textContent = count;

  const group = (key, title, picked, body) => `<div class="fgroup ${S.openGroup === key ? 'open' : ''}">
      <button type="button" class="fgroup-head" data-group="${key}">${title}<span class="picked">${esc(picked)}</span>${svg(ICON.chevron, 16, 2.2)}</button>
      <div class="fgroup-body">${body}</div></div>`;

  const groups = filtersOf(v).map(([k, title]) => {
    const tally = {};
    items.forEach(it => { const val = fieldVal(it, k); if (val) tally[val] = (tally[val] || 0) + 1; });
    const opts = k === '_promo' ? [PROMO_ON, PROMO_SOON].filter(o => tally[o]) : Object.keys(tally).sort((a, b) => a.localeCompare(b, 'vi', {numeric: true}));
    if (opts.length < (k === '_promo' ? 1 : 2)) return '';   // chỉ 1 lựa chọn thì lọc không có ý nghĩa (trừ khuyến mãi)
    const chosen = S.picked[k] || [];
    return group(k, title, chosen.join(', '), `<div class="chips">${opts.map(o =>
      `<button type="button" class="chip ${chosen.includes(o) ? 'on' : ''}" data-fkey="${k}" data-fval="${esc(o)}">${esc(k === 'size' ? sizeTxt(o) : o)}<small>${tally[o]}</small></button>`).join('')}</div>`);
  }).join('');

  const sortBox = group('sort', 'Sắp xếp', S.sort === 'default' ? '' : SORTS.find(s => s[0] === S.sort)[1],
    `<div class="chips">${SORTS.map(([k, t]) => `<button type="button" class="chip ${S.sort === k ? 'on' : ''}" data-sort="${k}">${t}</button>`).join('')}</div>`);

  // Nút nhanh "Khuyến mãi" cạnh nút Lọc
  const onCount = items.filter(it => promoInfo(it)?.state === 'on').length;
  const pb = $('#promoBtn');
  pb.hidden = !onCount;
  pb.classList.toggle('on', !!S.picked._promo?.includes(PROMO_ON));
  pb.innerHTML = `${svg(ICON.promo, 15, 2.2)}Khuyến mãi <small>${onCount}</small>`;

  $('#filterPanel').innerHTML = `<div class="filter-groups">${groups}${sortBox}</div>
    <div class="filter-foot"><button type="button" class="btn" data-act="clearFilters">Xoá tất cả</button><button type="button" class="btn primary" data-act="closeFilters">Xem ${visibleItems().length} mã</button></div>`;
}

function setFilterPanel(open) {
  $('#filterPanel').classList.toggle('open', open);
  $('#filterBtn').setAttribute('aria-expanded', open);
}

/* ---------- Popup chi tiết ---------- */
let sheetPushed = false;
function openDetail(code, {push = true} = {}) {
  const sec = section();
  const it = sec?.items.find(x => String(x.code) === String(code));
  if (!it) return;
  const v = view(sec);
  const unit = unitOf(sec, it);
  const lv = stockLevel(sec, it);
  let kpis = '';
  if (lv) {
    const m2 = toNum(it.stockM2);
    kpis = `<div class="kpis ${lv === 'ok' ? '' : lv} ${Number.isFinite(m2) ? '' : 'single'}">
      <div class="kpi"><b>${lv === 'out' ? 'Hết hàng' : fmt(toNum(it.stockBox), 1)}</b><span>${lv === 'out' ? 'tồn kho' : unit + ' tồn kho'}${lv === 'low' ? ' · sắp hết' : ''}</span></div>
      ${Number.isFinite(m2) ? `<div class="kpi"><b>${fmt(m2, 1)}</b><span>m² tồn kho</span></div>` : ''}</div>`;
  }
  const specs = v.specs.filter(([k]) => it[k] !== undefined && it[k] !== '').map(([k, label, u]) => {
    let val = k === 'size' ? sizeTxt(it[k]) : showVal(it[k]);
    if (u && !lower(val).includes(lower(u.split('/')[0]))) val += ' ' + (u === 'kg/đơn vị' ? `kg/${unit}` : u);
    return `<div><dt>${esc(label)}</dt><dd>${esc(val)}</dd></div>`;
  }).join('');
  const photos = photosOf(it);
  $('#sheet').innerHTML = `<button type="button" class="sheet-close" data-act="closeSheet" aria-label="Đóng">${svg(ICON.close, 16, 2.2)}</button>
    <div class="detail">
      <div class="detail-photo">${galleryMarkup(photos, it.code)}</div>
      <div class="detail-info">
        <h2>${esc(it.code)}</h2>
        <div class="subtitle">${esc(v.sub.map(k => it[k]).filter(Boolean).join(' · '))}</div>
        ${promoBox(it)}
        ${kpis}
        ${calcMarkup(sec, it)}
        <h3 class="section-title">Thông tin sản phẩm</h3>
        <dl class="specs">${specs}</dl>
        <div class="actions">
          <button type="button" class="btn primary" data-act="copyCode" data-code="${esc(it.code)}">Copy mã</button>
          <button type="button" class="btn" data-act="shareItem" data-code="${esc(it.code)}">Gửi link</button>
          ${it.folder ? `<a class="btn" href="${esc(it.folder)}" target="_blank" rel="noopener">Thư mục ảnh ↗</a>` : ''}
        </div>
      </div>
    </div>`;
  S.photos = photos;
  wireGallery();
  wireCalc(sec, it);
  $('#backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  $('#sheet').scrollTop = 0;
  if (push) { history.pushState({sheet: code}, '', `?tab=${encodeURIComponent(sec.id)}&ma=${encodeURIComponent(code)}`); sheetPushed = true; }
}

function closeDetail(fromHistory = false) {
  if (!$('#backdrop').classList.contains('open')) return;
  $('#backdrop').classList.remove('open');
  document.body.style.overflow = '';
  if (sheetPushed && !fromHistory) history.back();
  else if (!sheetPushed && location.search) history.replaceState(null, '', location.pathname);
  sheetPushed = false;
}

// Mở thẳng sản phẩm từ link chia sẻ: ?tab=san&ma=NS001
function openFromUrl() {
  const p = new URLSearchParams(location.search);
  const code = p.get('ma');
  if (!code || $('#backdrop').classList.contains('open')) return;
  if (p.get('tab') && S.data.sections.some(s => s.id === p.get('tab')) && p.get('tab') !== S.tab) { S.tab = p.get('tab'); render(); }
  openDetail(code, {push: false});
}

function promoBox(it) {
  const pr = promoInfo(it);
  if (!pr) return '';
  return `<div class="promo-box ${pr.state}">
    <div class="promo-head">${svg(ICON.promo, 16, 2.2)}<b>${pr.state === 'soon' ? 'Khuyến mãi sắp diễn ra' : 'Chương trình khuyến mãi'}</b>${pr.note ? `<span class="promo-note">${esc(pr.note)}</span>` : ''}</div>
    <p class="promo-text">${esc(pr.text)}</p>
    <div class="promo-period">Thời gian áp dụng: <b>${esc(pr.period)}</b></div></div>`;
}

/* ---------- Album ảnh trong popup ---------- */
function galleryMarkup(photos, code) {
  if (!photos.length) return NO_PHOTO;
  const many = photos.length > 1;
  const slides = photos.map((p, i) => `<button type="button" class="g-slide" data-act="zoom" data-i="${i}" aria-label="Xem ảnh ${i + 1} toàn màn hình">
      <img src="${esc(imgUrl(p, 900))}" data-hd="${esc(imgUrl(p, 1600))}" alt="${esc(code)} – ảnh ${i + 1}" ${i ? 'loading="lazy"' : ''}></button>`).join('');
  return `<div class="gallery">
      <div class="g-track" id="gTrack">${slides}</div>
      ${many ? `<button type="button" class="g-nav prev" data-gnav="-1" aria-label="Ảnh trước">${svg(ICON.prev, 20, 2.4)}</button>
      <button type="button" class="g-nav next" data-gnav="1" aria-label="Ảnh sau">${svg(ICON.next, 20, 2.4)}</button>
      <span class="g-counter" id="gCounter">1 / ${photos.length}</span>` : ''}
    </div>
    ${many ? `<div class="g-thumbs" id="gThumbs">${photos.map((p, i) => `<button type="button" class="g-thumb ${i ? '' : 'on'}" data-thumb="${i}" aria-label="Ảnh ${i + 1}">
      <img src="${esc(imgUrl(p, 200))}" alt="" loading="lazy" data-fallback></button>`).join('')}</div>` : ''}`;
}

function wireGallery() {
  S.gIndex = 0;
  const track = $('#gTrack');
  if (!track) return;
  // Mỗi ảnh: hiện bản vừa trước, tải xong bản nét thì thay; lỗi thì hiện "Chưa có ảnh"
  $$('img[data-hd]', track).forEach(im => {
    const upgrade = () => {
      if (im.dataset.up) return;
      im.dataset.up = 1;
      const hd = new Image();
      hd.onload = () => { im.src = hd.src; };
      hd.src = im.dataset.hd;
    };
    const fail = () => { if (!im.dataset.up) im.closest('.g-slide').innerHTML = NO_PHOTO; };
    if (im.complete && im.naturalWidth) upgrade();
    else { im.addEventListener('load', upgrade); im.addEventListener('error', fail, {once: true}); }
  });
  wireImages($('#gThumbs') || track);
  const last = S.photos.length - 1;
  const mark = i => {
    S.gIndex = i;
    if ($('#gCounter')) $('#gCounter').textContent = `${i + 1} / ${S.photos.length}`;
    $$('.g-thumb').forEach((t, k) => t.classList.toggle('on', k === i));
    $('.g-nav.prev')?.toggleAttribute('disabled', i === 0);
    $('.g-nav.next')?.toggleAttribute('disabled', i === last);
    const th = $(`.g-thumb[data-thumb="${i}"]`), strip = $('#gThumbs');   // cuộn dải ảnh nhỏ (không cuộn cả popup)
    if (th && strip) {
      const l = th.offsetLeft, r = l + th.offsetWidth;
      if (l < strip.scrollLeft) strip.scrollLeft = l - 8;
      else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 8;
    }
  };
  let raf;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.max(0, Math.min(last, Math.round(track.scrollLeft / track.clientWidth)));
      if (i !== S.gIndex) mark(i);
    });
  }, {passive: true});
  S.galleryGo = i => {
    i = Math.max(0, Math.min(last, i));
    track.scrollTo({left: i * track.clientWidth, behavior: 'smooth'});
    mark(i);
  };
  mark(0);
}

/* ---------- Bộ tính vật tư ---------- */
function packOf(it) {                          // "10 thanh/bó" → {per: 10, pack: 'bó'}
  const s = String(it.packing || it.piecesPerBox || '');
  return {per: toNum(s) > 0 ? toNum(s) : NaN, pack: lower(s.split('/')[1] || 'hộp').trim() || 'hộp'};
}

function calcPlan(sec, it) {
  const mode = view(sec).calc;
  const unit = unitOf(sec, it);
  if (mode === 'area') {
    const pcs = toNum(it.piecesPerBox);
    let m2 = toNum(it.m2PerBox);
    if (!(m2 > 0)) {                            // thiếu m²/hộp → dài × rộng × số tấm
      const [a, b] = String(it.size || '').split(/x|×|\*/i).map(toNum);
      if (a > 0 && b > 0 && pcs > 0) m2 = a * b / 1e6 * pcs;
    }
    if (!(m2 > 0)) return null;
    return {mode: 'area', m2PerBox: m2, pcs: pcs > 0 ? pcs : NaN, kg: toNum(it.weight), waste: /xương cá|chevron/i.test(it.pattern || '') ? 10 : 5};
  }
  const base = {unit, kgEach: toNum(it.weightUnit ?? it.weight), ...packOf(it)};
  if (mode === 'auto') {
    const [a, b] = String(it.size || '').split(/x|×|\*/i).map(toNum);
    if (unit === 'thanh' && a > 0) return {...base, mode: 'length', barM: a / 1000, waste: 5};
    if (unit === 'tấm' && /bậc/i.test(it.line || '')) return {...base, mode: 'qty', label: 'Số bậc cầu thang', waste: 0};
    if (unit === 'tấm' && a > 0 && b > 0) return {...base, mode: 'piece', pieceM2: a * b / 1e6, waste: 5};
  }
  return {...base, mode: 'qty', label: `Số lượng cần (${unit})`, waste: 0};
}

function calcMarkup(sec, it) {
  const p = calcPlan(sec, it);
  if (!p) return '';
  const mem = saved.get(KEY.calc) || {};
  const field = (id, label, ph) => `<label class="field"><span>${label}</span><input id="${id}" inputmode="decimal" placeholder="${ph}" value="${esc(mem[id] || '')}"></label>`;
  const areaInputs = `<div class="seg"><button type="button" data-cmode="m2" class="${mem.cmode !== 'lw' ? 'on' : ''}">Nhập m²</button><button type="button" data-cmode="lw" class="${mem.cmode === 'lw' ? 'on' : ''}">Dài × Rộng</button></div>
      <div class="inputs" id="boxM2" ${mem.cmode === 'lw' ? 'hidden' : ''}>${field('cM2', 'Diện tích cần (m²)', 'vd 25')}</div>
      <div class="inputs" id="boxLW" ${mem.cmode === 'lw' ? '' : 'hidden'}>${field('cL', 'Dài (m)', 'vd 5,2')}<span class="x">×</span>${field('cW', 'Rộng (m)', 'vd 4')}</div>`;
  const inputs = p.mode === 'length' ? `<div class="inputs">${field('cLen', 'Tổng chiều dài cần (m)', 'vd 36')}</div>`
    : p.mode === 'qty' ? `<div class="inputs">${field('cQty', esc(p.label), 'vd 2')}</div>`
    : areaInputs;
  const presets = p.mode === 'qty' ? [0, 3, 5, 10] : [3, 5, 8, 10, 15];
  return `<details class="calc" id="calc">
    <summary>${svg(ICON.calc, 18, 2)}Tính vật tư</summary>
    <div class="calc-body">
      ${inputs}
      <div class="waste"><span>Hao hụt</span>${presets.map(x => `<button type="button" class="chip ${x === p.waste ? 'on' : ''}" data-waste="${x}">${x}%</button>`).join('')}
        <label class="waste-custom"><input id="cWaste" inputmode="decimal" value="${p.waste}" aria-label="Hao hụt %">%</label></div>
      <div class="result" id="cResult"></div>
      <div class="calc-hint" id="cHint"></div>
      <button type="button" class="btn calc-share" id="cShare">Chia sẻ kết quả</button>
    </div></details>`;
}

function wireCalc(sec, it) {
  const box = $('#calc');
  if (!box) return;
  const p = calcPlan(sec, it);
  const val = id => toNum($('#' + id)?.value);
  let cmode = (saved.get(KEY.calc) || {}).cmode === 'lw' ? 'lw' : 'm2';
  let shareText = '';
  const stock = toNum(it.stockBox);

  function remember() {
    const mem = saved.get(KEY.calc) || {};
    ['cM2', 'cL', 'cW', 'cLen', 'cQty'].forEach(id => { if ($('#' + id)) mem[id] = $('#' + id).value; });
    mem.cmode = cmode;
    saved.set(KEY.calc, mem);
  }
  const cell = (b, s, cls = '') => `<div class="${cls}"><b>${b}</b><span>${s}</span></div>`;
  const stockCell = (need, u) => !Number.isFinite(stock) ? '' : stock >= need
    ? cell('Đủ hàng', `tồn kho ${fmt(stock, 0)} ${u}`, 'enough')
    : cell(`Thiếu ${fmt(need - stock, 0)} ${u}`, `tồn kho ${fmt(Math.max(stock, 0), 0)} ${u}`, 'short');
  const areaInput = () => cmode === 'lw' ? val('cL') * val('cW') : val('cM2');
  const areaBasis = a => (cmode === 'lw' ? `${fmt(val('cL'))} × ${fmt(val('cW'))} = ` : '') + `${fmt(a)} m²`;

  function run() {
    remember();
    const waste = Math.max(0, val('cWaste') || 0) / 100;
    let html = '', hint = '', lines = [];
    const head = `${it.code}${it.line || it.name ? ' (' + (it.line || it.name) + ')' : ''}`;

    if (p.mode === 'area') {
      hint = `1 hộp = ${fmt(p.m2PerBox, 4)} m²` + (p.pcs ? ` = ${fmt(p.pcs, 0)} tấm` : '') + (p.kg > 0 ? ` ≈ ${fmt(p.kg)} kg` : '');
      const area = areaInput();
      if (area > 0) {
        const need = area * (1 + waste);
        const boxes = Math.ceil(need / p.m2PerBox - 1e-9);
        const buy = boxes * p.m2PerBox;
        html = cell(`${fmt(boxes, 0)} hộp`, `cần mua · ${fmt(buy)} m²`, 'big') +
          cell(`${fmt(need)} m²`, 'gồm hao hụt') + cell(`${fmt(buy - need)} m²`, 'dư so với cần') +
          (p.pcs ? cell(`${fmt(boxes * p.pcs, 0)} tấm`, 'tổng số tấm') : '') +
          (p.kg > 0 ? cell(`≈ ${fmt(boxes * p.kg, 0)} kg`, 'khối lượng') : '') + stockCell(boxes, 'hộp');
        lines = [head, `Diện tích: ${areaBasis(area)} + hao hụt ${fmt(waste * 100)}% = ${fmt(need)} m²`, `→ ${boxes} hộp = ${fmt(buy)} m²`];
      }
    } else {
      const U = p.unit;
      let count = NaN, basis = '', extra = '';
      if (p.mode === 'length') {
        hint = `1 ${U} dài ${fmt(p.barM)} m`;
        const len = val('cLen');
        if (len > 0) {
          const need = len * (1 + waste);
          count = Math.ceil(need / p.barM - 1e-9);
          basis = `Chiều dài: ${fmt(len)} m + hao hụt ${fmt(waste * 100)}% = ${fmt(need)} m`;
          extra = cell(`${fmt(need)} m`, 'gồm hao hụt') + cell(`${fmt(count * p.barM - need)} m`, 'dư sau khi cắt');
        }
      } else if (p.mode === 'piece') {
        hint = `1 ${U} = ${fmt(p.pieceM2, 3)} m²`;
        const area = areaInput();
        if (area > 0) {
          const need = area * (1 + waste);
          count = Math.ceil(need / p.pieceM2 - 1e-9);
          basis = `Diện tích: ${areaBasis(area)} + hao hụt ${fmt(waste * 100)}% = ${fmt(need)} m²`;
          extra = cell(`${fmt(need)} m²`, 'gồm hao hụt') + cell(`${fmt(count * p.pieceM2)} m²`, `${fmt(count, 0)} ${U} phủ được`);
        }
      } else {
        const q = val('cQty');
        if (q > 0) {
          count = Math.ceil(q * (1 + waste) - 1e-9);
          basis = `${p.label}: ${fmt(q)}` + (waste ? ` + hao hụt ${fmt(waste * 100)}%` : '');
        }
      }
      if (count > 0) {
        const full = Math.floor(count / p.per), odd = count - full * p.per;
        const packTxt = !Number.isFinite(p.per) || p.per <= 1 ? '' : full ? `${fmt(full, 0)} ${p.pack}${odd ? ` + ${fmt(odd, 0)} ${U}` : ''}` : `${fmt(odd, 0)} ${U} lẻ`;
        const kg = count * p.kgEach;
        html = cell(`${fmt(count, 0)} ${U}`, 'cần mua' + (p.mode === 'length' ? ` (${U} dài ${fmt(p.barM)} m)` : ''), 'big') + extra +
          (packTxt ? cell(packTxt, `quy cách ${esc(it.packing)}`) : '') +
          (kg > 0 ? cell(`≈ ${fmt(kg, 1)} kg`, 'khối lượng') : '') + stockCell(count, U);
        lines = [head, basis, `→ ${count} ${U}` + (packTxt ? ` = ${packTxt}` : '')];
      }
    }
    if (lines.length && Number.isFinite(stock)) lines.push(`Tồn kho hiện tại: ${fmt(Math.max(stock, 0), 0)} ${p.mode === 'area' ? 'hộp' : p.unit}`);
    $('#cResult').innerHTML = html;
    $('#cHint').textContent = hint ? hint + (html ? '' : '. Nhập số liệu để tính.') : '';
    shareText = lines.join('\n');
  }

  box.addEventListener('input', e => {
    if (e.target.id === 'cWaste') $$('[data-waste]', box).forEach(b => b.classList.toggle('on', +b.dataset.waste === val('cWaste')));
    run();
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.waste) {
      $('#cWaste').value = b.dataset.waste;
      $$('[data-waste]', box).forEach(x => x.classList.toggle('on', x === b));
      run();
    } else if (b.dataset.cmode) {
      cmode = b.dataset.cmode;
      $$('[data-cmode]', box).forEach(x => x.classList.toggle('on', x === b));
      $('#boxM2').hidden = cmode !== 'm2';
      $('#boxLW').hidden = cmode !== 'lw';
      run();
    } else if (b.id === 'cShare') {
      if (!shareText) return toast('Nhập số liệu trước đã');
      share({text: shareText}, 'Đã copy kết quả');
    }
  });
  run();
}

/* ---------- Chia sẻ / copy ---------- */
async function share(payload, copiedMsg) {
  if (navigator.share) { try { await navigator.share(payload); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const text = [payload.text, payload.url].filter(Boolean).join('\n');
  try { await navigator.clipboard.writeText(text); toast(copiedMsg); } catch (e) { toast('Không copy được'); }
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Xem ảnh toàn màn hình (chụm/kéo/chạm đúp, vuốt ngang đổi ảnh, vuốt dọc đóng) ---------- */
const V = {list: [], i: 0, scale: 1, x: 0, y: 0, w: 0, h: 0, fingers: new Map(), start: null, lastTap: 0, moved: false, axis: null, pushed: false};
const vImg = () => $('#viewerImg');

function vFit() {
  const im = vImg();
  const nw = im.naturalWidth || 4, nh = im.naturalHeight || 3;
  const k = Math.min(innerWidth / nw, innerHeight / nh);
  V.w = nw * k; V.h = nh * k;
  Object.assign(im.style, {width: V.w + 'px', height: V.h + 'px', marginLeft: -V.w / 2 + 'px', marginTop: -V.h / 2 + 'px'});
}
function vClamp() {
  const mx = Math.max(0, (V.w * V.scale - innerWidth) / 2), my = Math.max(0, (V.h * V.scale - innerHeight) / 2);
  V.x = Math.min(mx, Math.max(-mx, V.x));
  V.y = Math.min(my, Math.max(-my, V.y));
}
function vDraw(bg = 1) {
  vImg().style.transform = `translate(${V.x}px, ${V.y}px) scale(${V.scale})`;
  $('#viewerBg').style.opacity = bg;
}
function vAnimate(change, after) {
  const el = $('#viewer');
  el.classList.add('animate');
  change();
  setTimeout(() => { el.classList.remove('animate'); after?.(); }, 260);
}
function vZoomAt(scale, px, py, from = V) {      // giữ điểm (px, py) đứng yên dưới ngón tay
  const cx = innerWidth / 2, cy = innerHeight / 2;
  const ix = (px - cx - from.x) / from.scale, iy = (py - cy - from.y) / from.scale;
  V.scale = scale; V.x = px - cx - scale * ix; V.y = py - cy - scale * iy;
}

// Hiện ảnh thứ i; enterFrom = -1/1 để ảnh trượt vào từ trái/phải
function vShow(i, fromImg, enterFrom = 0) {
  const el = $('#viewer'), im = vImg();
  V.i = i;
  Object.assign(V, {scale: 1, x: enterFrom * innerWidth * 0.35, y: 0, fingers: new Map(), start: null, moved: false, axis: null});
  const ready = () => { vFit(); vDraw(); };
  im.onload = ready;
  im.src = fromImg?.currentSrc || fromImg?.src || imgUrl(V.list[i], 1400);
  if (im.complete && im.naturalWidth) ready();
  const hd = new Image();                       // rồi tải bản thật nét để phóng to
  hd.onload = () => { if (!el.hidden && V.i === i) im.src = hd.src; };
  hd.src = imgUrl(V.list[i], 2400);
  [i - 1, i + 1].forEach(k => { if (V.list[k]) new Image().src = imgUrl(V.list[k], 1400); });   // tải trước ảnh kề bên
  const many = V.list.length > 1;
  $('#viewerCount').hidden = !many;
  $('#viewerCount').textContent = `${i + 1} / ${V.list.length}`;
  $('#viewerPrev').hidden = !many || i === 0;
  $('#viewerNext').hidden = !many || i === V.list.length - 1;
  if (enterFrom) requestAnimationFrame(() => vAnimate(() => { V.x = 0; vDraw(); }));
}
function vStep(dir) {
  const j = V.i + dir;
  if (j < 0 || j >= V.list.length) return vAnimate(() => { V.x = 0; V.y = 0; vDraw(); });
  vAnimate(() => { V.x = -dir * innerWidth; vDraw(); }, () => {
    vShow(j, null, dir);
    S.galleryGo?.(j);                             // album trong popup đi theo
  });
}

function openViewer(list, index = 0, fromImg) {
  V.list = list;
  $('#viewer').hidden = false;
  vShow(index, fromImg);
  const hint = $('#viewerHint');
  hint.textContent = list.length > 1 ? 'Vuốt ngang để xem ảnh khác · vuốt dọc để đóng' : 'Chụm 2 ngón để phóng to · vuốt để đóng';
  hint.style.opacity = 1;
  setTimeout(() => { hint.style.opacity = 0; }, 2400);
  history.pushState({viewer: 1}, '');
  V.pushed = true;
}
function closeViewer(fromHistory = false) {
  const el = $('#viewer');
  if (el.hidden) return;
  el.hidden = true;
  if (V.pushed && !fromHistory) { V.pushed = false; history.back(); }
  V.pushed = false;
}

function initViewer() {
  const el = $('#viewer');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
  const snapshot = pts => ({scale: V.scale, x: V.x, y: V.y, p0: pts[0], d: pts[1] ? dist(pts[0], pts[1]) : 0, m: pts[1] ? mid(pts[0], pts[1]) : null, t: Date.now()});

  el.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* một số máy lỗi với ngón thứ 2 */ }
    V.fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    V.moved = false; V.axis = null;
    V.start = snapshot([...V.fingers.values()]);
  });
  el.addEventListener('pointermove', e => {
    if (!V.fingers.has(e.pointerId) || !V.start) return;
    V.fingers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    const pts = [...V.fingers.values()], st = V.start;
    if (pts.length > 1 && st.d) {                      // 2 ngón: phóng + kéo
      const m = mid(pts[0], pts[1]);
      vZoomAt(Math.min(8, Math.max(0.4, st.scale * dist(pts[0], pts[1]) / st.d)), st.m.x, st.m.y, st);
      V.x += m.x - st.m.x; V.y += m.y - st.m.y;
      V.moved = true; V.axis = 'pinch';
      vDraw(V.scale < 1 ? Math.max(0.3, V.scale) : 1);
    } else if (pts.length === 1) {
      const dx = pts[0].x - st.p0.x, dy = pts[0].y - st.p0.y;
      if (Math.hypot(dx, dy) > 6) V.moved = true;
      if (st.scale > 1.01) {                          // đang phóng: kéo để xem
        V.x = st.x + dx; V.y = st.y + dy; vClamp(); vDraw();
        return;
      }
      if (!V.axis && V.moved) V.axis = Math.abs(dx) > Math.abs(dy) && V.list.length > 1 ? 'x' : 'y';
      if (V.axis === 'x') {                           // vuốt ngang: đổi ảnh (đầu/cuối danh sách thì kéo nặng tay)
        const edge = (dx > 0 && V.i === 0) || (dx < 0 && V.i === V.list.length - 1);
        V.x = edge ? dx * 0.3 : dx; V.y = 0; vDraw();
      } else if (V.axis === 'y') {                    // vuốt dọc: kéo để đóng
        V.x = dx * 0.4; V.y = dy;
        vDraw(Math.max(0.25, 1 - Math.abs(dy) / (innerHeight * 0.6)));
      }
    }
  });
  const end = e => {
    if (!V.fingers.has(e.pointerId)) return;
    const st = V.start, wasPinch = V.fingers.size > 1;
    V.fingers.delete(e.pointerId);
    if (V.fingers.size) { V.start = snapshot([...V.fingers.values()]); V.axis = st?.scale > 1.01 ? null : V.axis; return; }
    if (!st) return;
    if (wasPinch || st.d || V.axis === 'pinch') {
      if (V.scale < 0.85) return vAnimate(() => { V.scale = 0.3; vDraw(0); }, () => closeViewer());
      if (V.scale < 1) return vAnimate(() => { V.scale = 1; V.x = V.y = 0; vDraw(); });
      vClamp(); return vAnimate(() => vDraw());
    }
    if (!V.moved) {                                    // chạm đúp: phóng 2,5× / về cũ
      const now = Date.now();
      if (now - V.lastTap < 300) {
        V.lastTap = 0;
        vAnimate(() => { if (V.scale > 1.01) { V.scale = 1; V.x = V.y = 0; } else { vZoomAt(2.5, e.clientX, e.clientY); vClamp(); } vDraw(); });
      } else V.lastTap = now;
      return;
    }
    if (st.scale > 1.01) return;
    const ms = Math.max(1, Date.now() - st.t);
    if (V.axis === 'x') {
      const fast = Math.abs(V.x) / ms > 0.5;
      if (Math.abs(V.x) > innerWidth * 0.18 || fast) return vStep(V.x < 0 ? 1 : -1);
      return vAnimate(() => { V.x = 0; vDraw(); });
    }
    if (V.axis === 'y') {
      if (Math.abs(V.y) > 90 || Math.abs(V.y) / ms > 0.6) {
        const dir = Math.sign(V.y) || 1;
        return vAnimate(() => { V.y = dir * innerHeight; vDraw(0); }, () => closeViewer());
      }
      vAnimate(() => { V.x = V.y = 0; vDraw(); });
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => {                   // máy tính: lăn chuột để zoom
    e.preventDefault();
    vZoomAt(Math.min(8, Math.max(1, V.scale * Math.exp(-e.deltaY * 0.0015))), e.clientX, e.clientY);
    vClamp(); vDraw();
  }, {passive: false});
  $('#viewerClose').addEventListener('click', e => { e.stopPropagation(); closeViewer(); });
  $('#viewerPrev').addEventListener('click', e => { e.stopPropagation(); vStep(-1); });
  $('#viewerNext').addEventListener('click', e => { e.stopPropagation(); vStep(1); });
  ['gesturestart', 'gesturechange'].forEach(n => document.addEventListener(n, e => { if (!el.hidden) e.preventDefault(); }));
  addEventListener('resize', () => { if (!el.hidden) { vFit(); vClamp(); vDraw(); } });
}

/* ---------- Sự kiện ---------- */
function resetFilters() { S.picked = {}; S.sort = 'default'; }

document.addEventListener('click', e => {
  const b = e.target.closest('button, a');
  if ($('#filterPanel').classList.contains('open') && !e.target.closest('#filterPanel, #filterBtn')) setFilterPanel(false);
  if (e.target === $('#backdrop')) return closeDetail();
  if (!b) return;
  const d = b.dataset;
  if (d.tab) {
    S.tab = d.tab; resetFilters(); S.openGroup = null;
    saved.set(KEY.tab, S.tab);
    render(); scrollTo(0, 0);
  } else if (b.id === 'filterBtn') setFilterPanel(!$('#filterPanel').classList.contains('open'));
  else if (d.fkey) {
    const list = S.picked[d.fkey] || [];
    S.picked[d.fkey] = list.includes(d.fval) ? list.filter(x => x !== d.fval) : [...list, d.fval];
    renderFilters(); renderCards();
  } else if (d.group) { S.openGroup = S.openGroup === d.group ? null : d.group; renderFilters(); }
  else if (d.sort) { S.sort = d.sort; renderFilters(); renderCards(); }
  else if (d.code && b.classList.contains('card')) openDetail(d.code);
  else if (d.gnav) S.galleryGo?.(S.gIndex + +d.gnav);
  else if (d.thumb) S.galleryGo?.(+d.thumb);
  else switch (d.act) {
    case 'togglePromo':
      S.picked._promo = S.picked._promo?.includes(PROMO_ON) ? [] : [PROMO_ON];
      renderFilters(); renderCards(); break;
    case 'clearFilters': resetFilters(); renderFilters(); renderCards(); break;
    case 'closeFilters': setFilterPanel(false); break;
    case 'resetAll': resetFilters(); $('#search').value = ''; S.query = ''; $('.searchbox').classList.remove('filled'); renderFilters(); renderCards(); break;
    case 'closeSheet': closeDetail(); break;
    case 'zoom': openViewer(S.photos, +d.i || 0, b.querySelector('img')); break;
    case 'copyCode': navigator.clipboard?.writeText(d.code).then(() => toast('Đã copy mã ' + d.code), () => toast('Không copy được')); break;
    case 'shareItem': {
      const url = `${location.origin}${location.pathname}?tab=${encodeURIComponent(S.tab)}&ma=${encodeURIComponent(d.code)}`;
      share({title: d.code, text: `${d.code} — ${S.data?.store || C.STORE_NAME}`, url}, 'Đã copy link sản phẩm');
      break;
    }
    case 'reload': load(); break;
  }
});

document.addEventListener('keydown', e => {
  const viewing = !$('#viewer').hidden;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (viewing) return vStep(dir);
    if ($('#backdrop').classList.contains('open') && !/INPUT/.test(document.activeElement?.tagName)) S.galleryGo?.(S.gIndex + dir);
    return;
  }
  if (e.key !== 'Escape') return;
  if (viewing) return closeViewer();
  if ($('#filterPanel').classList.contains('open')) return setFilterPanel(false);
  closeDetail();
});

addEventListener('popstate', () => {
  if (!$('#viewer').hidden) return closeViewer(true);
  if ($('#backdrop').classList.contains('open')) closeDetail(true);
  else openFromUrl();
});

let searchTimer;
$('#search').addEventListener('input', e => {
  $('.searchbox').classList.toggle('filled', !!e.target.value);
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { S.query = e.target.value; renderCards(); renderFilters(); }, 120);
});
$('#search').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });   // ẩn bàn phím điện thoại
$('#searchClear').addEventListener('click', e => {
  e.preventDefault();
  $('#search').value = ''; S.query = '';
  $('.searchbox').classList.remove('filled');
  renderCards(); renderFilters();
  $('#search').focus();
});

initViewer();
render();   // hiện ngay dữ liệu đã lưu (nếu có)
load();     // rồi tải bản mới nhất
})();
