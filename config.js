/* =====================================================================
   CẤU HÌNH WEB — VLXD Nam Sơn
   Sửa file này để đổi tên, nguồn dữ liệu, bộ lọc, thông số hiển thị.
   ===================================================================== */
window.CONFIG = {
  STORE_NAME: 'VLXD Nam Sơn',

  // Dán URL Web App của Google Apps Script (kết thúc bằng /exec) vào đây.
  // Để trống '' thì web chạy bằng dữ liệu mẫu trong demo-data.js.
  API_URL: 'https://script.google.com/macros/s/AKfycbzJbeAFh1uhEoeFdWWmWxDCsicnNS4FWjFeua6simACWB1MMdhsoNrzKgReF3GKcvmi/exec',

  // Mỗi danh mục: id phải trùng với id trong Apps Script (san, tbvs, pk).
  //  badge   : trường hiện thành nhãn nhỏ trên ảnh thẻ
  //  line2   : trường hiện dưới mã trên thẻ
  //  sub     : các trường hiện dưới tiêu đề trong popup chi tiết
  //  search  : các trường được tìm kiếm
  //  filters : [trường, tên bộ lọc]
  //  specs   : [trường, tên hiển thị, (đơn vị/định dạng)] — theo đúng thứ tự
  //  calc    : cách tính vật tư: 'area' (theo m²), 'qty' (theo số lượng), 'auto' (phụ kiện: tự chọn theo đơn vị tính)
  VIEWS: {
    san: {
      icon: 'floor',
      badge: 'line',
      line2: it => it.color,
      sub: ['line', 'brand'],
      search: ['code', 'line', 'brand', 'color', 'colorGroup', 'size', 'pattern'],
      filters: [['line', 'Dòng sản phẩm'], ['brand', 'Nhãn hiệu'], ['colorGroup', 'Nhóm màu'], ['pattern', 'Kiểu lát'], ['size', 'Kích thước'], ['thickness', 'Độ dày tấm']],
      specs: [
        ['line', 'Dòng sản phẩm'], ['brand', 'Nhãn hiệu'], ['pattern', 'Kiểu lát'], ['color', 'Màu sắc'],
        ['size', 'Kích thước', 'mm'], ['thickness', 'Độ dày tấm', 'mm'], ['layer', 'Lớp chống mài mòn', 'mm'],
        ['lock', 'Hèm khóa'], ['water', 'Chống nước'], ['piecesPerBox', 'Đóng hộp', 'tấm/hộp'],
        ['m2PerBox', 'Quy cách', 'm²/hộp'], ['weight', 'Trọng lượng hộp', 'kg'], ['note', 'Ghi chú'],
      ],
      calc: 'area',
    },
    tbvs: {
      icon: 'toilet',
      badge: 'type',
      line2: it => it.name,
      sub: ['type', 'brand'],
      search: ['code', 'type', 'brand', 'name', 'color', 'material', 'origin'],
      filters: [['type', 'Loại sản phẩm'], ['brand', 'Nhãn hiệu'], ['color', 'Màu sắc'], ['material', 'Chất liệu'], ['origin', 'Xuất xứ']],
      specs: [
        ['name', 'Tên / Model'], ['type', 'Loại sản phẩm'], ['brand', 'Nhãn hiệu'], ['color', 'Màu sắc'],
        ['size', 'Kích thước', 'mm'], ['material', 'Chất liệu'], ['origin', 'Xuất xứ'], ['warranty', 'Bảo hành'],
        ['unit', 'Đơn vị tính'], ['packing', 'Quy cách'], ['weight', 'Trọng lượng', 'kg'], ['note', 'Ghi chú'],
      ],
      calc: 'qty',
    },
    pk: {
      icon: 'puzzle',
      badge: null,
      line2: it => it.line,
      sub: ['line'],
      search: ['code', 'line', 'size', 'unit'],
      filters: [['line', 'Dòng sản phẩm'], ['unit', 'Đơn vị tính'], ['size', 'Kích thước']],
      specs: [
        ['line', 'Dòng sản phẩm'], ['size', 'Kích thước', 'mm'], ['unit', 'Đơn vị tính'], ['packing', 'Quy cách'],
        ['weightUnit', 'Trọng lượng', 'kg/đơn vị'], ['note', 'Ghi chú'],
      ],
      calc: 'auto',
    },
  },
};
