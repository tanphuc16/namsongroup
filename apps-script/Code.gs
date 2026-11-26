/**
 * VLXD Nam Sơn — Apps Script gắn với Google Sheet dữ liệu
 *
 * 1) doGet(): Web App trả JSON cho website (Triển khai → Ứng dụng web → Bất kỳ ai).
 * 2) Menu "Nam Sơn" trên Sheet → "Nhập / cập nhật từ Excel…":
 *    chỉ ghi những cột CÓ trong file Excel, các cột khác trên Sheet giữ nguyên.
 * 3) Ảnh: cột "Ảnh" chỉ chứa 1 LINK THƯ MỤC Google Drive cho mỗi mã.
 *    Script tự lấy tối đa 7 ảnh trong thư mục (xếp theo tên file) và nhớ lại trong tab ẩn "_AnhCache".
 */

// ===================== CẤU HÌNH =====================
// tab   : tên tab trên Google Sheet
// cols  : key dùng trên web  →  tiêu đề cột trên Sheet (không phân biệt hoa/thường, có dấu/không dấu)
const SECTIONS = [
  {
    id: 'san', tab: 'Sàn', title: 'Sàn', unit: 'hộp', lowStock: 20,
    cols: {
      code: 'Mã sản phẩm', line: 'Dòng sản phẩm', brand: 'Nhãn hiệu', colorGroup: 'Nhóm màu', color: 'Màu sắc',
      pattern: 'Kiểu lát', size: 'Kích thước (mm)', thickness: 'Độ dày tấm (mm)', layer: 'Lớp chống mài mòn (mm)',
      lock: 'Hèm khóa', water: 'Chống nước', piecesPerBox: 'Số tấm/hộp', m2PerBox: 'm²/hộp',
      weight: 'Trọng lượng hộp (kg)', stockBox: 'Tồn kho (hộp)', stockM2: 'Tồn kho (m²)',
      promo: 'Chương trình khuyến mãi', promoFrom: 'Khuyến mãi từ ngày', promoTo: 'Khuyến mãi đến ngày',
      image: 'Ảnh', note: 'Ghi chú',
    },
  },
  {
    id: 'tbvs', tab: 'Thiết bị vệ sinh', title: 'Thiết bị vệ sinh', unit: 'cái', lowStock: 3,
    cols: {
      code: 'Mã sản phẩm', type: 'Loại sản phẩm', brand: 'Nhãn hiệu', name: 'Tên / Model', color: 'Màu sắc',
      size: 'Kích thước (mm)', material: 'Chất liệu', origin: 'Xuất xứ', warranty: 'Bảo hành', unit: 'Đơn vị tính',
      packing: 'Quy cách', weight: 'Trọng lượng (kg)', stockBox: 'Tồn kho',
      promo: 'Chương trình khuyến mãi', promoFrom: 'Khuyến mãi từ ngày', promoTo: 'Khuyến mãi đến ngày',
      image: 'Ảnh', note: 'Ghi chú',
    },
  },
  {
    id: 'pk', tab: 'Phụ kiện', title: 'Phụ kiện', unit: 'cái', lowStock: 20,
    cols: {
      code: 'Mã sản phẩm', line: 'Dòng sản phẩm', size: 'Kích thước (mm)', unit: 'Đơn vị tính', packing: 'Quy cách',
      weightUnit: 'Trọng lượng (kg/đơn vị)', stockBox: 'Tồn kho',
      promo: 'Chương trình khuyến mãi', promoFrom: 'Khuyến mãi từ ngày', promoTo: 'Khuyến mãi đến ngày',
      image: 'Ảnh', note: 'Ghi chú',
    },
  },
];
const CONFIG_TAB = 'Cấu hình';
const IMG_CACHE_TAB = '_AnhCache';   // tab ẩn: danh sách ảnh đã đọc của từng thư mục
const MAX_PHOTOS = 7;
const NUMERIC = ['piecesPerBox', 'm2PerBox', 'weight', 'weightUnit', 'stockBox', 'stockM2'];
// Tiêu đề trong file Excel được coi là cột "Mã sản phẩm"
const CODE_ALIASES = ['ma san pham', 'ma', 'ma sp', 'ma hang', 'ma hang hoa', 'ma vat tu', 'code', 'sku'];

// ===================== TIỆN ÍCH =====================
function norm_(s) {
  return String(s == null ? '' : s).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
    .replace(/m²|m2/g, 'm2').replace(/\s+/g, ' ');
}
// Ngày → "yyyy-MM-dd". Nhận ô kiểu Ngày của Sheet, hoặc chữ "25/12/2026", "25-12-2026", "2026-12-25"
function isoDate_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  return '';
}
function normCode_(v) { return String(v == null ? '' : v).trim().toUpperCase(); }
function isEmpty_(v) { return v === '' || v === null || v === undefined; }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'dd/MM/yyyy'); }
function toNumber_(v) {
  if (typeof v === 'number') return v;
  const m = String(v == null ? '' : v).match(/-?\d[\d.,]*/);
  if (!m) return NaN;
  let t = m[0];
  if (t.indexOf(',') >= 0 && t.indexOf('.') >= 0) t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (t.indexOf(',') >= 0) t = t.replace(',', '.');
  return parseFloat(t);
}
// Vị trí cột theo tiêu đề: {key: chỉ số cột (0-based)}
function headerIndex_(header, cols) {
  const pos = {};
  const normHeader = header.map(norm_);
  Object.keys(cols).forEach(k => {
    const i = normHeader.indexOf(norm_(cols[k]));
    if (i >= 0) pos[k] = i;
  });
  return pos;
}

// ===================== WEB APP (JSON cho website) =====================
function doGet() {
  let out;
  try { out = buildData_(); } catch (err) { out = {error: String(err && err.message || err)}; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function readConfig_(ss) {
  const cfg = {};
  const sh = ss.getSheetByName(CONFIG_TAB);
  if (!sh || sh.getLastRow() < 2) return cfg;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(([k, v]) => {
    if (!k) return;
    cfg[norm_(k)] = v instanceof Date ? Utilities.formatDate(v, tz_(), 'dd/MM/yyyy') : v;
  });
  return cfg;
}

function buildData_() {
  const ss = SpreadsheetApp.getActive();
  const cfg = readConfig_(ss);
  const imgCache = loadImgCache_();
  const sections = SECTIONS.map(sec => {
    const base = {id: sec.id, title: sec.title, unit: sec.unit,
      lowStock: toNumber_(cfg[norm_('Ngưỡng sắp hết - ' + sec.title)]) || sec.lowStock,
      updated: cfg[norm_('Ngày cập nhật tồn kho')] || '', items: []};
    const sh = ss.getSheetByName(sec.tab);
    if (!sh) return Object.assign(base, {error: 'Không thấy tab "' + sec.tab + '"'});
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return base;
    const pos = headerIndex_(values[0], sec.cols);
    if (pos.code === undefined) return Object.assign(base, {error: 'Thiếu cột "' + sec.cols.code + '"'});
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (isEmpty_(row[pos.code])) continue;
      const it = {};
      Object.keys(pos).forEach(k => {
        let v = row[pos[k]];
        if (isEmpty_(v)) return;
        if (k === 'promoFrom' || k === 'promoTo') { v = isoDate_(v); if (v) it[k] = v; return; }
        if (v instanceof Date) v = Utilities.formatDate(v, tz_(), 'dd/MM/yyyy');
        else if (NUMERIC.indexOf(k) >= 0) { const n = toNumber_(v); v = isNaN(n) ? String(v).trim() : n; }
        else v = typeof v === 'number' ? v : String(v).trim();
        it[k] = v;
      });
      it.code = String(it.code);
      if (it.image !== undefined) {                 // link thư mục → danh sách ảnh
        const ref = imageRef_(it.image);
        delete it.image;
        if (ref.folder) { it.folder = ref.url; it.images = photosOfFolder_(ref.folder, imgCache); }
        else if (ref.file) it.images = [ref.file];
      }
      // Sàn: thiếu "Tồn kho (m²)" thì tự tính = số hộp × m²/hộp
      if (it.stockM2 === undefined && typeof it.stockBox === 'number' && typeof it.m2PerBox === 'number')
        it.stockM2 = Math.round(it.stockBox * it.m2PerBox * 100) / 100;
      base.items.push(it);
    }
    return base;
  });
  if (imgCache.dirty) {                            // nhiều người mở web cùng lúc: chỉ 1 người ghi bộ nhớ ảnh
    const lock = LockService.getScriptLock();
    if (lock.tryLock(2000)) { try { saveImgCache_(imgCache); } finally { lock.releaseLock(); } }
  }
  return {store: cfg[norm_('Tên cửa hàng')] || 'VLXD Nam Sơn', generated: new Date().toISOString(), sections: sections};
}

// ===================== ẢNH: LINK THƯ MỤC → DANH SÁCH ẢNH =====================
// Ô "Ảnh" có thể là: link thư mục (khuyên dùng), link 1 file ảnh, hoặc link ảnh bất kỳ.
function imageRef_(v) {
  const s = String(v || '').trim().split(/\s+/)[0];
  if (!s) return {};
  let m = s.match(/\/folders\/([-\w]{20,})/);
  if (m) return {folder: m[1], url: 'https://drive.google.com/drive/folders/' + m[1]};
  m = s.match(/(?:\/file\/d\/|\/d\/|[?&]id=)([-\w]{20,})/) || s.match(/^([-\w]{20,})$/);
  if (m) {
    // Link dạng open?id=… hoặc chỉ ID: có thể là thư mục → hỏi Drive (có ghi nhớ)
    if (isFolderId_(m[1])) return {folder: m[1], url: 'https://drive.google.com/drive/folders/' + m[1]};
    return {file: m[1]};
  }
  return /^https?:\/\//.test(s) ? {file: s} : {};
}
function isFolderId_(id) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('isFolder:' + id);
  if (hit) return hit === '1';
  let yes = false;
  try { DriveApp.getFolderById(id); yes = true; } catch (e) { yes = false; }
  cache.put('isFolder:' + id, yes ? '1' : '0', 21600);
  return yes;
}

// Đọc ảnh trong 1 thư mục: chỉ file ảnh, xếp theo tên (1, 2, … 10), lấy tối đa 7
function listFolderPhotos_(folderId) {
  const files = [];
  const it = DriveApp.getFolderById(folderId).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (String(f.getMimeType()).indexOf('image/') === 0 && !f.isTrashed()) files.push({id: f.getId(), name: f.getName()});
  }
  files.sort((a, b) => a.name.localeCompare(b.name, 'vi', {numeric: true, sensitivity: 'base'}));
  return files.slice(0, MAX_PHOTOS).map(f => f.id);
}

// Bộ nhớ ảnh lưu ở tab ẩn: A = ID thư mục, B = ID ảnh (cách nhau dấu phẩy), C = lúc đọc
function loadImgCache_() {
  const c = {map: {}, dirty: false, budget: 25, started: Date.now()};
  const sh = SpreadsheetApp.getActive().getSheetByName(IMG_CACHE_TAB);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(([id, ids, t]) => {
      if (id) c.map[id] = {ids: String(ids || '').split(',').filter(Boolean), t: t};
    });
  }
  return c;
}
function saveImgCache_(c) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(IMG_CACHE_TAB);
  if (!sh) { sh = ss.insertSheet(IMG_CACHE_TAB); sh.hideSheet(); }
  sh.clearContents();
  const rows = [['ID thư mục', 'ID ảnh', 'Đọc lúc']].concat(Object.keys(c.map).map(id => [id, c.map[id].ids.join(','), c.map[id].t || '']));
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
}
// Thư mục mới (chưa có trong bộ nhớ) thì đọc ngay, giới hạn số lượng để web không phải chờ lâu
function photosOfFolder_(folderId, c) {
  if (c.map[folderId]) return c.map[folderId].ids;
  if (c.budget <= 0 || Date.now() - c.started > 15000) return [];
  c.budget--;
  let ids = [];
  try { ids = listFolderPhotos_(folderId); } catch (e) { ids = []; }
  c.map[folderId] = {ids: ids, t: new Date()};
  c.dirty = true;
  return ids;
}

// Tất cả link thư mục đang dùng trên các tab
function allFolderRefs_() {
  const ss = SpreadsheetApp.getActive();
  const out = [];
  SECTIONS.forEach(sec => {
    const sh = ss.getSheetByName(sec.tab);
    if (!sh || sh.getLastRow() < 2) return;
    const values = sh.getDataRange().getValues();
    const pos = headerIndex_(values[0], sec.cols);
    if (pos.image === undefined) return;
    for (let r = 1; r < values.length; r++) {
      const ref = imageRef_(values[r][pos.image]);
      if (ref.folder) out.push({folder: ref.folder, code: values[r][pos.code], tab: sec.tab});
    }
  });
  return out;
}

/** Đọc lại ảnh của MỌI thư mục (menu, hoặc tự chạy 30 phút/lần). */
function refreshImages() {
  const started = Date.now();
  const old = loadImgCache_();
  const fresh = {map: {}, dirty: true};
  const refs = allFolderRefs_();
  const empty = [], failed = [];
  let done = 0;
  refs.forEach(ref => {
    if (fresh.map[ref.folder]) return;
    if (Date.now() - started > 300000) {            // gần hết 6 phút: giữ bản cũ, lần sau đọc tiếp
      if (old.map[ref.folder]) fresh.map[ref.folder] = old.map[ref.folder];
      return;
    }
    try {
      const ids = listFolderPhotos_(ref.folder);
      fresh.map[ref.folder] = {ids: ids, t: new Date()};
      if (!ids.length) empty.push(ref.code);
      done++;
    } catch (e) { failed.push(ref.code); }
  });
  saveImgCache_(fresh);
  return {folders: done, empty: empty, failed: failed};
}

function refreshImagesNow() {
  const ui = SpreadsheetApp.getUi();
  SpreadsheetApp.getActive().toast('Đang đọc ảnh trong các thư mục…', 'Nam Sơn', 30);
  const r = refreshImages();
  ui.alert('Cập nhật ảnh',
    'Đã đọc ' + r.folders + ' thư mục.' +
    (r.empty.length ? '\n\nThư mục chưa có ảnh (' + r.empty.length + '): ' + r.empty.slice(0, 40).join(', ') : '') +
    (r.failed.length ? '\n\nKhông mở được thư mục (sai link hoặc chưa chia sẻ): ' + r.failed.slice(0, 40).join(', ') : '') +
    '\n\nTải lại trang web để thấy ảnh mới.', ui.ButtonSet.OK);
}

/** Tạo sẵn thư mục ảnh cho các mã chưa có link, rồi tự điền link vào cột "Ảnh". */
function createPhotoFolders() {
  const ui = SpreadsheetApp.getUi();
  const cfg = readConfig_(SpreadsheetApp.getActive());
  const savedLink = cfg[norm_('Thư mục ảnh gốc')] || '';
  const ask = ui.prompt('Tạo thư mục ảnh cho từng mã',
    'Dán link THƯ MỤC GỐC trên Google Drive (ví dụ thư mục "Anh-san-pham").\n' +
    'Script sẽ tạo bên trong: Sàn / NS001, NS002…; Thiết bị vệ sinh / TB001…\n' +
    'Chỉ tạo cho mã có ô "Ảnh" đang trống.' + (savedLink ? '\n\nĐể trống = dùng lại thư mục đã nhập lần trước.' : ''),
    ui.ButtonSet.OK_CANCEL);
  if (ask.getSelectedButton() !== ui.Button.OK) return;
  const link = ask.getResponseText().trim() || String(savedLink);
  const m = link.match(/\/folders\/([-\w]{20,})/) || link.match(/^([-\w]{20,})$/);
  if (!m) return ui.alert('Link thư mục không đúng. Mở thư mục trên Drive rồi copy link trên thanh địa chỉ.');
  let root;
  try { root = DriveApp.getFolderById(m[1]); } catch (e) { return ui.alert('Không mở được thư mục này. Kiểm tra lại link hoặc quyền truy cập.'); }
  setConfig_('Thư mục ảnh gốc', root.getUrl());
  // Ai có link đều xem được → ảnh bên trong hiện được trên web
  try { root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* tài khoản công ty có thể chặn */ }

  const child = (parent, name) => {
    const it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  };
  const ss = SpreadsheetApp.getActive();
  const started = Date.now();
  let made = 0, stopped = false;
  SECTIONS.forEach(sec => {
    if (stopped) return;
    const sh = ss.getSheetByName(sec.tab);
    if (!sh || sh.getLastRow() < 2) return;
    const values = sh.getDataRange().getValues();
    const pos = headerIndex_(values[0], sec.cols);
    if (pos.image === undefined || pos.code === undefined) return;
    const col = values.slice(1).map(r => [r[pos.image]]);
    let tabFolder = null, changed = false;
    for (let r = 1; r < values.length; r++) {
      const code = String(values[r][pos.code] || '').trim();
      if (!code || !isEmpty_(values[r][pos.image])) continue;
      if (Date.now() - started > 300000) { stopped = true; break; }
      tabFolder = tabFolder || child(root, sec.tab);
      col[r - 1][0] = child(tabFolder, code).getUrl();
      changed = true; made++;
    }
    if (changed) sh.getRange(2, pos.image + 1, col.length, 1).setValues(col);
  });
  ui.alert('Tạo thư mục ảnh', 'Đã tạo và điền link cho ' + made + ' mã.' +
    (stopped ? '\nCòn mã chưa làm xong do hết thời gian, hãy chạy lại lần nữa.' : '') +
    '\n\nBây giờ chỉ cần bỏ ảnh (tối đa 7 tấm) vào thư mục của từng mã.\nĐặt tên 1.jpg, 2.jpg… để chọn thứ tự; ảnh đầu tiên là ảnh đại diện.', ui.ButtonSet.OK);
}

/** Bật/tắt tự đọc lại ảnh mỗi 30 phút. */
function toggleAutoRefresh() {
  const ui = SpreadsheetApp.getUi();
  const mine = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshImages');
  if (mine.length) {
    mine.forEach(t => ScriptApp.deleteTrigger(t));
    return ui.alert('Đã TẮT tự động cập nhật ảnh.');
  }
  ScriptApp.newTrigger('refreshImages').timeBased().everyMinutes(30).create();
  refreshImages();
  ui.alert('Đã BẬT tự động cập nhật ảnh: cứ 30 phút script đọc lại các thư mục một lần.\nCần ảnh hiện ngay thì dùng menu "Cập nhật ảnh ngay".');
}

// ===================== MENU TRÊN SHEET =====================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Nam Sơn')
    .addItem('Nhập / cập nhật từ Excel…', 'showImportDialog')
    .addItem('Đặt ngày cập nhật tồn kho = hôm nay', 'stampToday')
    .addSeparator()
    .addItem('Tạo thư mục ảnh cho các mã chưa có…', 'createPhotoFolders')
    .addItem('Cập nhật ảnh ngay', 'refreshImagesNow')
    .addItem('Bật / tắt tự động cập nhật ảnh (30 phút)', 'toggleAutoRefresh')
    .addSeparator()
    .addItem('Kiểm tra dữ liệu', 'checkData')
    .addToUi();
}

function showImportDialog() {
  const html = HtmlService.createHtmlOutputFromFile('ImportExcel').setWidth(760).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Nhập / cập nhật từ file Excel');
}

function stampToday() {
  setConfig_('Ngày cập nhật tồn kho', today_());
  SpreadsheetApp.getActive().toast('Đã đặt ngày cập nhật tồn kho: ' + today_());
}

function setConfig_(key, value) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CONFIG_TAB);
  if (!sh) { sh = ss.insertSheet(CONFIG_TAB); sh.appendRow(['Thiết lập', 'Giá trị', 'Giải thích']); }
  const last = sh.getLastRow();
  const keys = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => norm_(r[0])) : [];
  const i = keys.indexOf(norm_(key));
  if (i >= 0) sh.getRange(i + 2, 2).setNumberFormat('@').setValue(value);
  else sh.appendRow([key, value, '']);
}

function checkData() {
  const d = buildData_();
  const lines = d.sections.map(s => {
    if (s.error) return '✗ ' + s.title + ': ' + s.error;
    const codes = {}, dup = [];
    s.items.forEach(it => { const c = normCode_(it.code); if (codes[c]) dup.push(it.code); codes[c] = 1; });
    const noImg = s.items.filter(it => !(it.images && it.images.length)).length;
    const today = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd');
    const promos = s.items.filter(it => it.promo);
    const live = promos.filter(it => (!it.promoFrom || it.promoFrom <= today) && (!it.promoTo || it.promoTo >= today)).length;
    const badDate = promos.filter(it => it.promoFrom && it.promoTo && it.promoTo < it.promoFrom).map(it => it.code);
    return '✓ ' + s.title + ': ' + s.items.length + ' mã' + (dup.length ? ' · TRÙNG MÃ: ' + dup.join(', ') : '') + (noImg ? ' · ' + noImg + ' mã chưa có ảnh' : '') +
      (promos.length ? ' · ' + live + ' mã đang khuyến mãi' : '') + (badDate.length ? ' · NGÀY KM SAI (đến ngày trước từ ngày): ' + badDate.join(', ') : '');
  });
  SpreadsheetApp.getUi().alert('Kiểm tra dữ liệu', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

// ===================== NHẬP EXCEL (gọi từ ImportExcel.html) =====================
function getImportTabs() {
  return SECTIONS.map(s => s.tab);
}

/**
 * sheets: [{name, target, rows: [[...], ...]}]   (rows = toàn bộ ô của 1 worksheet Excel)
 * opt   : {apply: bool, addNew: bool, clearEmpty: bool, stampDate: bool}
 * Trả về báo cáo cho từng worksheet. apply=false → chỉ xem trước, không ghi gì.
 */
function importExcel(sheets, opt) {
  opt = opt || {};
  const lock = LockService.getDocumentLock();
  if (opt.apply && !lock.tryLock(30000)) throw new Error('Có người khác đang cập nhật, thử lại sau ít phút.');
  try {
    const reports = sheets.map(s => importOne_(s, opt));
    const changed = reports.reduce((n, r) => n + (r.cellsChanged || 0) + (r.added || 0), 0);
    if (opt.apply && opt.stampDate && changed) setConfig_('Ngày cập nhật tồn kho', today_());
    if (opt.apply) SpreadsheetApp.flush();
    return reports;
  } finally {
    if (opt.apply) lock.releaseLock();
  }
}

function importOne_(src, opt) {
  const rep = {name: src.name, target: src.target, matched: [], ignored: [], updatedCodes: 0, cellsChanged: 0,
    added: 0, notFound: [], duplicates: [], samples: [], error: ''};
  const sec = SECTIONS.filter(s => s.tab === src.target)[0];
  if (!sec) { rep.error = 'Bỏ qua'; return rep; }
  const sh = SpreadsheetApp.getActive().getSheetByName(sec.tab);
  if (!sh) { rep.error = 'Không thấy tab "' + sec.tab + '" trên Sheet'; return rep; }

  // 1) Tìm dòng tiêu đề trong Excel: dòng đầu tiên (trong 15 dòng) có cột Mã
  const rows = src.rows || [];
  let hRow = -1, xCode = -1;
  for (let r = 0; r < Math.min(15, rows.length) && hRow < 0; r++) {
    const i = rows[r].map(norm_).findIndex(h => CODE_ALIASES.indexOf(h) >= 0);
    if (i >= 0) { hRow = r; xCode = i; }
  }
  if (hRow < 0) { rep.error = 'Không tìm thấy cột "Mã sản phẩm" trong 15 dòng đầu'; return rep; }

  // 2) Ghép cột Excel ↔ cột Sheet theo tiêu đề
  const range = sh.getDataRange();
  const values = range.getValues();
  const header = values[0].map(String);
  const sheetNorm = header.map(norm_);
  const sCode = headerIndex_(header, sec.cols).code;
  if (sCode === undefined) { rep.error = 'Tab "' + sec.tab + '" thiếu cột "' + sec.cols.code + '"'; return rep; }
  const map = [];     // [{x: cột Excel, s: cột Sheet, name}]
  rows[hRow].forEach((h, x) => {
    if (x === xCode || isEmpty_(h)) return;
    const s = sheetNorm.indexOf(norm_(h));
    if (s >= 0 && s !== sCode) { map.push({x: x, s: s, name: header[s]}); rep.matched.push(header[s]); }
    else rep.ignored.push(String(h));
  });
  if (!map.length) { rep.error = 'Không có cột nào trùng tên với cột trên Sheet'; return rep; }

  // 3) So sánh từng dòng
  const index = {};
  for (let r = 1; r < values.length; r++) { const c = normCode_(values[r][sCode]); if (c && index[c] === undefined) index[c] = r; }
  const newVals = values.map(row => row.slice());
  const touched = {};       // cột Sheet đã thay đổi
  const seen = {}, newRows = [];
  const numLike = v => typeof v === 'number' || /^\s*-?[\d.,]+\s*$/.test(String(v));
  const same = (a, b) => {                       // 2,5 và 2.5 coi là bằng nhau; "1220x183" vẫn so như chữ
    if (isEmpty_(a) || isEmpty_(b)) return isEmpty_(a) && isEmpty_(b);
    if (a instanceof Date) a = fmtCell_(a);
    if (numLike(a) && numLike(b)) return Math.abs(toNumber_(a) - toNumber_(b)) < 1e-9;
    return String(a).trim() === String(b).trim();
  };
  for (let r = hRow + 1; r < rows.length; r++) {
    const xr = rows[r];
    const code = normCode_(xr[xCode]);
    if (!code) continue;
    if (seen[code]) { rep.duplicates.push(code); continue; }
    seen[code] = 1;
    const sr = index[code];
    if (sr === undefined) {
      if (!opt.addNew) { rep.notFound.push(String(xr[xCode]).trim()); continue; }
      const row = header.map(() => '');
      row[sCode] = String(xr[xCode]).trim();
      map.forEach(m => { if (!isEmpty_(xr[m.x])) row[m.s] = xr[m.x]; });
      newRows.push(row); rep.added++;
      if (rep.samples.length < 40) rep.samples.push({code: row[sCode], col: '(mã mới)', from: '', to: 'thêm dòng mới'});
      continue;
    }
    let changedRow = false;
    map.forEach(m => {
      let v = xr[m.x];
      if (isEmpty_(v) && !opt.clearEmpty) return;   // ô trống trong Excel: mặc định giữ nguyên Sheet
      if (isEmpty_(v)) v = '';
      const old = values[sr][m.s];
      if (same(old, v)) return;
      newVals[sr][m.s] = v; touched[m.s] = true; changedRow = true; rep.cellsChanged++;
      if (rep.samples.length < 40) rep.samples.push({code: values[sr][sCode], col: m.name, from: fmtCell_(old), to: fmtCell_(v)});
    });
    if (changedRow) rep.updatedCodes++;
  }
  if (!opt.apply) return rep;

  // 4) Ghi: chỉ những cột có thay đổi; ô không đổi giữ nguyên công thức (nếu có)
  const nRows = values.length - 1;
  if (nRows > 0) {
    const formulas = range.getFormulas();
    Object.keys(touched).forEach(k => {
      const s = +k;
      const col = [];
      for (let r = 1; r < values.length; r++) {
        const changed = newVals[r][s] !== values[r][s];
        col.push([!changed && formulas[r][s] ? formulas[r][s] : newVals[r][s]]);
      }
      sh.getRange(2, s + 1, nRows, 1).setValues(col);
    });
  }
  if (newRows.length) sh.getRange(sh.getLastRow() + 1, 1, newRows.length, header.length).setValues(newRows);
  return rep;
}

function fmtCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'dd/MM/yyyy');
  return isEmpty_(v) ? '(trống)' : String(v);
}
