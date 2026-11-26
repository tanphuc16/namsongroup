# VLXD Nam Sơn — Hướng dẫn triển khai

Website tra cứu **Sàn · Thiết bị vệ sinh · Phụ kiện** và tồn kho.
Giao diện chạy trên **GitHub Pages** (miễn phí), dữ liệu nằm trên **Google Sheets**, ảnh để trên **Google Drive**.

```
Google Sheet ──(Apps Script, JSON)──► Website (GitHub Pages)
     ▲
     └── Menu "Nam Sơn → Nhập / cập nhật từ Excel…" (chỉ ghi các cột có trong file Excel)
```

## Các file trong bộ

| File / thư mục | Dùng để |
|---|---|
| `index.html`, `style.css`, `app.js` | Giao diện web |
| `config.js` | **File bạn sẽ sửa**: URL dữ liệu, bộ lọc, thông số hiển thị |
| `demo-data.js`, `demo-img/` | Dữ liệu và ảnh mẫu, chỉ dùng khi chưa điền `API_URL` |
| `manifest.webmanifest`, `icons/` | Cài web thành app trên điện thoại |
| `apps-script/Code.gs`, `apps-script/ImportExcel.html` | Mã dán vào Google Sheet |
| `mau-du-lieu/VLXD-NamSon-Du-lieu.xlsx` | Sheet mẫu đủ 4 tab, đúng tên cột |
| `mau-du-lieu/Vi-du-file-cap-nhat-ton-kho.xlsx` | File ví dụ để thử tính năng nhập Excel |

---

## Bước 1. Tạo Google Sheet dữ liệu (5 phút)

1. Vào Google Drive → **Mới → Tải tệp lên** → chọn `mau-du-lieu/VLXD-NamSon-Du-lieu.xlsx`.
2. Mở file vừa tải lên → **Tệp → Lưu dưới dạng Google Trang tính**. Từ giờ chỉ dùng bản Google Trang tính này.
3. Xoá dữ liệu mẫu và nhập hàng thật. **Giữ nguyên tên các tab và dòng tiêu đề** (có thể thêm cột riêng của bạn, web sẽ bỏ qua cột lạ).

Sheet có 4 tab:
- **Sàn**: mỗi dòng là một mã. *Tồn kho (m²)* để trống thì web tự tính = số hộp × m²/hộp.
- **Thiết bị vệ sinh**: *Đơn vị tính* là Bộ hoặc Cái.
- **Phụ kiện**: *Đơn vị tính* quyết định cách tính vật tư:
  - **Thanh** → tính theo chiều dài (số đầu của *Kích thước* là chiều dài thanh, đơn vị mm).
  - **Tấm** → tính theo diện tích; riêng dòng có chữ “bậc” thì tính theo số bậc.
  - Đơn vị khác → tính theo số lượng.
- **Cấu hình**: tên cửa hàng, ngày cập nhật tồn kho, ngưỡng “sắp hết” của từng danh mục.

## Bước 2. Gắn Apps Script và tạo đường dẫn dữ liệu (5 phút)

1. Trong Google Sheet: **Tiện ích mở rộng → Apps Script**.
2. Xoá nội dung có sẵn trong `Mã.gs`, dán toàn bộ `apps-script/Code.gs` vào.
3. Bấm **＋ → HTML**, đặt tên **`ImportExcel`** (đúng chữ hoa/thường), dán toàn bộ `apps-script/ImportExcel.html` vào.
4. Bấm **Lưu** (biểu tượng đĩa mềm).
5. **Triển khai → Tùy chọn triển khai mới** → bánh răng → **Ứng dụng web**:
   - Thực thi với tư cách: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**
   - Bấm **Triển khai** → **Cấp quyền truy cập** → chọn tài khoản Google → *Nâng cao → Đi tới… (không an toàn)* → **Cho phép**. Cảnh báo này là bình thường với script do chính bạn tạo.
6. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`).
7. Kiểm tra: dán URL vào trình duyệt. Nếu thấy chữ JSON bắt đầu bằng `{"store":"VLXD Nam Sơn"…` là đã chạy.
8. Tải lại trang Google Sheet. Trên thanh menu sẽ có thêm menu **Nam Sơn**.

> Nếu bạn đã triển khai bản cũ trước đây: sau khi dán `Code.gs` mới, vào **Triển khai → Quản lý triển khai → ✏️ → Phiên bản mới → Triển khai**, rồi bấm **Cho phép** khi Google hỏi thêm quyền Google Drive (cần quyền này để đọc ảnh trong thư mục).

> Sửa dữ liệu trên Sheet thì **không cần** triển khai lại. Chỉ khi sửa mã trong `Code.gs` mới cần: **Triển khai → Quản lý triển khai → ✏️ → Phiên bản: Phiên bản mới → Triển khai**. URL giữ nguyên.

## Bước 3. Nối web với Sheet

Mở `config.js`, dán URL vào:

```js
API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec',
```

Khi đã dùng dữ liệu thật, có thể xoá thư mục `demo-img/` (ảnh mẫu).

## Bước 4. Đưa lên GitHub Pages (10 phút)

1. Đăng nhập [github.com](https://github.com) → **New repository**, đặt tên ví dụ `vlxd-namson`, chọn **Public** → **Create repository**.
2. Bấm **uploading an existing file** → kéo thả **toàn bộ nội dung** thư mục `namson` (cả các thư mục con) → **Commit changes**.
3. Vào **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: **main** / **/(root)** → **Save**.
4. Đợi 1–2 phút, web chạy tại: `https://<tên-tài-khoản>.github.io/vlxd-namson/`

Cài lên điện thoại như một app:
- **iPhone (Safari)**: nút Chia sẻ → **Thêm vào MH chính**.
- **Android (Chrome)**: menu ⋮ → **Thêm vào màn hình chính**.

## Bước 5. Ảnh sản phẩm: mỗi mã 1 thư mục, tối đa 7 ảnh

Cột **Ảnh** trên Sheet chỉ chứa **1 link thư mục Google Drive** cho mỗi mã. Web tự lấy các ảnh trong thư mục đó (tối đa 7 tấm), không cần dán link từng ảnh.

**Cách nhanh nhất: để script tạo thư mục giúp**
1. Trên Google Drive, tạo một thư mục gốc, ví dụ `Anh-san-pham`. Mở thư mục đó rồi copy link trên thanh địa chỉ.
2. Trên Sheet: menu **Nam Sơn → Tạo thư mục ảnh cho các mã chưa có…** → dán link thư mục gốc → **OK**.
   Lần đầu Google sẽ hỏi quyền truy cập Drive, bấm **Cho phép**.
3. Script sẽ:
   - Tạo sẵn các thư mục `Sàn/NS001`, `Sàn/NS002`, `Thiết bị vệ sinh/TB001`…
   - Điền link thư mục vào cột **Ảnh** của từng mã. Mã đã có link thì giữ nguyên.
   - Chia sẻ thư mục gốc ở chế độ "Bất kỳ ai có đường liên kết – Người xem", để web xem được ảnh.
4. Mở thư mục của từng mã và **kéo ảnh vào** (1–7 tấm).
5. Khi thêm mã mới vào Sheet, chạy lại menu này. Script chỉ tạo thư mục cho các mã chưa có.

**Hoặc làm tay:** tạo thư mục cho mã, chia sẻ "Bất kỳ ai có đường liên kết", copy link thư mục, rồi dán vào ô **Ảnh**.

**Thứ tự ảnh:**
- Ảnh xếp theo **tên file**. Đặt tên `1.jpg`, `2.jpg` … `7.jpg` để tự chọn thứ tự.
- Ảnh đầu tiên là **ảnh đại diện** hiện trên thẻ sản phẩm.
- Thư mục có hơn 7 ảnh thì chỉ lấy 7 ảnh đầu. File không phải ảnh (PDF, video…) sẽ bị bỏ qua.

**Khi nào ảnh mới hiện lên web?**
- Mã mới, thư mục mới: hiện ngay ở lần tải web kế tiếp.
- Thêm, xoá hoặc đổi ảnh trong thư mục đã có: web dùng danh sách ảnh đã nhớ để chạy nhanh, nên cần làm mới bằng một trong hai cách:
  - Menu **Nam Sơn → Cập nhật ảnh ngay**, hoặc
  - Bật **Nam Sơn → Bật / tắt tự động cập nhật ảnh (30 phút)** một lần. Sau đó cứ 30 phút script tự đọc lại các thư mục.
- Menu *Cập nhật ảnh ngay* cũng báo mã nào có thư mục trống, hoặc link thư mục bị sai hay chưa chia sẻ.

Trên web, khách bấm vào sản phẩm sẽ thấy album: vuốt ngang hoặc bấm mũi tên để xem các ảnh, bấm vào ảnh để xem toàn màn hình. Ở màn hình toàn màn hình: vuốt ngang để đổi ảnh, vuốt dọc để đóng, chụm 2 ngón để phóng to. Nút **"Thư mục ảnh ↗"** mở thẳng thư mục Drive của mã.

Mẹo: ảnh khoảng 1200–2000 px, dạng JPG là đẹp và nhẹ. Không cần tự thu nhỏ ảnh.

---

## Cập nhật dữ liệu hằng ngày

**Cách 1: sửa thẳng trên Google Sheet.** Web cập nhật ngay ở lần tải trang kế tiếp.

**Cách 2: nhập từ file Excel** (ví dụ file tồn kho xuất từ phần mềm kho):

1. Trên Sheet: menu **Nam Sơn → Nhập / cập nhật từ Excel…** → chọn file.
2. Với mỗi worksheet trong file, chọn tab sẽ cập nhật. Nếu tên worksheet trùng tên tab thì web tự chọn sẵn.
3. Bấm **Xem trước**: hiện cột nào sẽ được cập nhật, cột nào bị bỏ qua, bao nhiêu mã/ô thay đổi, giá trị cũ → mới.
4. Bấm **Cập nhật vào Sheet**.

Quy tắc:
- Dòng được ghép theo cột mã. Tên cột mã trong Excel có thể là *Mã sản phẩm*, *Mã*, *Mã SP*, *Mã hàng*, *SKU*…
- **Chỉ những cột có trong file Excel và trùng tên với cột trên Sheet mới được ghi.** Mọi cột khác trên Sheet (link thư mục ảnh, thông số, ghi chú…) giữ nguyên.
- Tên cột không phân biệt hoa/thường, có dấu hay không dấu (“Ton kho” = “Tồn kho”).
- Ô trống trong Excel mặc định **không** xoá dữ liệu trên Sheet. Muốn xoá thì tích tuỳ chọn tương ứng.
- Mã có trong Excel nhưng chưa có trên Sheet mặc định bị bỏ qua. Tích “thêm dòng mới” nếu muốn thêm.
- Ô có công thức trên Sheet mà Excel không làm thay đổi sẽ giữ nguyên công thức.
- Ngày “Tồn kho cập nhật đến ngày …” tự đổi thành hôm nay (bỏ tích nếu không muốn).

Thử ngay bằng file `mau-du-lieu/Vi-du-file-cap-nhat-ton-kho.xlsx`: file này chỉ có cột Mã và Tồn kho, nên chỉ tồn kho thay đổi.

Menu **Nam Sơn → Kiểm tra dữ liệu** báo số mã từng tab, mã bị trùng và mã chưa có ảnh.

---

## Tuỳ biến

- **Đổi tên cửa hàng**: sửa tab *Cấu hình* (và `STORE_NAME` trong `config.js`).
- **Đổi màu**: sửa `--red` / `--red-dark` / `--red-soft` ở đầu `style.css`.
- **Thêm một cột thông số** (ví dụ “Bảo hành” cho Sàn):
  1. Thêm cột trên Sheet.
  2. Trong `Code.gs`, thêm vào `cols` của mục đó, ví dụ `warranty: 'Bảo hành'`, rồi triển khai **phiên bản mới**.
  3. Trong `config.js`, thêm `['warranty', 'Bảo hành']` vào `specs` để hiện trong popup, hoặc vào `filters` để lọc được.
- **Thêm danh mục mới**: thêm tab trên Sheet, thêm một mục vào `SECTIONS` (Code.gs) và vào `VIEWS` (config.js) với cùng `id`.

## Chuyển sang website riêng sau này

Đây là web tĩnh nên chạy được trên mọi hosting: chép toàn bộ file lên thư mục gốc của hosting hoặc tên miền riêng (ví dụ `tracuu.vlxdnamson.vn`), không cần cài gì thêm. Google Sheet và Apps Script giữ nguyên. GitHub Pages cũng cho gắn tên miền riêng tại *Settings → Pages → Custom domain*.

## Lưu ý

- Tab ẩn **_AnhCache** là nơi script nhớ danh sách ảnh của từng thư mục. Đừng xoá hay sửa tab này; nếu lỡ xoá, chạy *Cập nhật ảnh ngay* là có lại.
- Ai có đường dẫn Apps Script đều đọc được dữ liệu trên web, giống như trang web công khai. **Không đưa giá vốn hay thông tin nội bộ vào các cột web đọc.** Cột lạ không có trong `Code.gs` sẽ không bị gửi ra ngoài.
- Web lưu bản dữ liệu gần nhất trên máy, nên khi mất mạng vẫn xem được (kèm thông báo).
- Link chia sẻ sản phẩm có dạng `…/?tab=san&ma=NS001`: người nhận mở là thấy ngay mã đó.
