# Mọt Tiếng Trung — Phân tích chức năng & Kế hoạch xây dựng web

Nguồn tham khảo: `Mọt Tiếng Trung - Kho tài liệu.html` (bản thiết kế 1 file, ~650 KB, JS thuần + ảnh base64) và `Mọt Tiếng Trung - Kho tài liệu.md` (bản text của giao diện).

Mục tiêu dự án: dựng lại web bằng **ReactJS**, có **CMS** quản lý tài khoản, tài liệu, lộ trình học; **chi phí 0 đồng** (hosting tĩnh miễn phí, backend tuỳ chọn ở gói free).

---

## 1. Phân tích file gốc

### 1.1 Cấu trúc kỹ thuật
| Thành phần | Trong file gốc | Vấn đề |
|---|---|---|
| CSS | 1 khối `<style>` ~44 KB, nhiều lớp ghi đè (`!important`) | Giữ nguyên để không vỡ giao diện, tách ra `legacy.css` |
| Ảnh | Logo, banner, 4 icon menu, QR ngân hàng, bìa sách, ảnh hướng dẫn app — tất cả là base64 | Làm file nặng; tách thành file trong `public/assets/` |
| Dữ liệu | Mảng JS cứng: `DOCS` (40 tài liệu), `DL` (lượt tải), `ARTS` (ảnh minh hoạ SVG), `ST` (9 chặng lộ trình), `TOOLS`, `APPS`, `PR` (prompt), `BANK`, `AFF` | Không sửa được nếu không biết code → cần CMS |
| Điều hướng | Hash `#kho`, `#lo-trinh`, `#on-tap`, `#cong-dong` | `#on-tap`, `#cong-dong` chưa có trang |
| Tài khoản | Nút avatar giả lập, chỉ đổi biến `logged` | Chưa có đăng ký/đăng nhập thật |

### 1.2 Danh sách chức năng hiện có (cần giữ)
**Đầu trang**
- Logo, nút “Cộng đồng”, chuông thông báo, menu tài khoản (đăng nhập / tạo tài khoản / đăng xuất).
- 4 thẻ điều hướng: Kho tài liệu · Lộ trình học · Ôn tập · Cộng đồng.
- Banner có 2 dòng chữ đè lên ảnh.

**Kho tài liệu (`#kho`)**
- Tìm kiếm không dấu (bỏ dấu tiếng Việt, “đ” → “d”).
- Lọc theo định dạng: Tất cả / PDF / PPT / SHEET / DOCX kèm số đếm.
- Sắp xếp: Mới nhất / Tải nhiều nhất. Nút “Đặt lại”.
- Phân trang 12 tài liệu/trang.
- Thẻ tài liệu: ảnh minh hoạ SVG sinh theo loại (sách, slide, bảng, bộ thủ, ô chữ, đề thi, thư…), nhãn định dạng, nhãn HOT (3 tài liệu tải nhiều nhất) hoặc FREE, loại (Thư mục / Google Sheet / Tệp), lượt tải, thanh mức quan tâm, nút “Tải xuống” mở Google Drive.
- Khung ủng hộ: mã QR (bấm để phóng to), thông tin ngân hàng, nút sao chép số tài khoản; dải “Ủng hộ Mọt”.

**Lộ trình học (`#lo-trinh`)**
- Hero: tiêu đề, 5 giai đoạn (Bắt đầu → Nhập môn → HSK1–3 → HSK4–6 → HSK7–9), con dấu HSK 3.0, hình ngọn núi.
- Bậc thang 9 bậc, bấm để cuộn tới chặng; ghim “Bạn ở đây”.
- Khung “Hành trình của bạn”: chặng hiện tại, nút “Tiếp tục học”, thanh % (chưa tính thật).
- 9 thẻ chặng: tiêu đề, mô tả, chip kỹ năng, nút “Vào học” (đặt chặng hiện tại + mở kho đã lọc theo từ khoá), mũi tên mở tài liệu.
  - Chặng 1: hộp **Túi đồ nghề** (3 dụng cụ, đánh dấu “Mình đã có”, link affiliate) và **App học** (3 tab: Hanzii, ChatGPT kèm prompt sao chép được, Doubao).
  - Chặng 2: các buổi học phát âm / bộ thủ.
  - Chặng HSK1–3: ruy-băng giáo trình, bảng thông tin, nút mua sách (affiliate), danh sách 15–18 bài.
- Khối “Thi chứng chỉ HSK” (chọn cấp) và “Đích đến”.

### 1.3 Chức năng còn thiếu / cần bổ sung
1. Đăng ký, đăng nhập, phân quyền (Quản trị / Biên tập / Học viên), khoá tài khoản.
2. CMS cho tài liệu (thêm/sửa/xoá/ẩn, đổi ảnh minh hoạ, lượt tải).
3. CMS cho lộ trình (thêm/sửa/xoá/sắp xếp chặng, chip, bài học, thông tin giáo trình).
4. CMS cài đặt: thông tin ngân hàng, tải ảnh QR, link affiliate.
5. Lưu tiến độ học theo tài khoản (chặng hiện tại, % thật, đồ nghề đã có).
6. “Kho của tôi”: lưu tài liệu yêu thích.
7. Đếm lượt tải thật khi bấm “Tải xuống”.
8. Trang Ôn tập & Cộng đồng (giai đoạn 1: trang “sắp ra mắt”).
9. Sao lưu / khôi phục dữ liệu (xuất – nhập JSON).

---

## 2. Kiến trúc đề xuất (chi phí 0đ)

```
Trình duyệt ──► React SPA (Vite, HashRouter tự viết)
                   │
                   ▼
             services/store.js  ── adapter ──► localAdapter (localStorage, mặc định)
                                          └──► supabaseAdapter (Supabase free tier, tuỳ chọn)
Hosting: GitHub Pages / Netlify / Vercel / Cloudflare Pages (đều miễn phí)
```

- **Frontend**: React 19 + Vite. Không dùng thư viện router/UI để nhẹ và dễ deploy tĩnh; dùng hash route (`#/lo-trinh`) nên chạy được trên mọi host tĩnh, không cần cấu hình rewrite.
- **Lớp dữ liệu**: mọi màn hình chỉ gọi `store` (API async). Đổi backend chỉ cần đổi biến môi trường `VITE_BACKEND`.
  - `local` (mặc định): dữ liệu và tài khoản lưu trong trình duyệt. Hợp để demo, chạy offline, và để admin soạn nội dung rồi **xuất JSON**.
  - `supabase`: Postgres + Auth miễn phí (500 MB DB, 50.000 người dùng/tháng ở gói free). Dữ liệu dùng chung cho mọi người. Schema + chính sách bảo mật (RLS) ở `docs/supabase.sql`.
- **Nội dung tĩnh dự phòng**: `public/content.json` (xuất từ CMS) được nạp khi trình duyệt chưa có dữ liệu → có thể cập nhật nội dung miễn phí bằng cách commit file này, không cần backend.
- **Bảo mật**: mật khẩu băm SHA-256 + salt (bản local); phân quyền kiểm tra ở cả giao diện và RLS (bản Supabase). Nội dung HTML do admin nhập (bài hướng dẫn App) được lọc thẻ `script`/thuộc tính `on*` trước khi hiển thị.

### 2.1 Mô hình dữ liệu
| Bảng | Trường chính |
|---|---|
| `documents` | id, name, format (PDF/PPT/SHEET/DOCX), url, downloads, art {kind, l1, l2, ch, color}, published, createdAt |
| `stages` | id, order, key (tên bậc), emoji, color, title, badge, desc, chips[], keyword, sections[], info[], lessons[], ribbon, ribbonColor, affKey, cover, boxes[] |
| `users` | id, name, email, passHash, role (admin/editor/member), status (active/locked), createdAt, progress {stageId, owned[], saved[]} |
| `settings` | bank {name, number, owner, qr}, affiliate {giaotrinh, giaotrinh2, giaotrinh3, but, vo}, tools[], apps[], prompts{} |

### 2.2 Phân quyền
| Quyền | Học viên | Biên tập | Quản trị |
|---|---|---|---|
| Xem kho, lộ trình, lưu tiến độ | ✓ | ✓ | ✓ |
| Sửa tài liệu, lộ trình | | ✓ | ✓ |
| Sửa cài đặt (ngân hàng, affiliate) | | | ✓ |
| Quản lý tài khoản, sao lưu/khôi phục | | | ✓ |

---

## 3. Cấu trúc thư mục
```
mot-tieng-trung/
├─ index.html, vite.config.js, package.json
├─ public/assets/            ảnh tách từ file gốc
├─ public/content.json        (tuỳ chọn) nội dung xuất từ CMS
├─ scripts/extract.mjs        trích dữ liệu/ảnh/CSS từ HTML gốc
├─ scripts/build.mjs          build dự phòng bằng esbuild
├─ docs/supabase.sql          schema + RLS cho Supabase
└─ src/
   ├─ main.jsx, App.jsx, router.js
   ├─ data/seed.json          dữ liệu gốc đã chuẩn hoá
   ├─ services/               store, localAdapter, supabaseAdapter, seed, crypto
   ├─ context/                AppContext (dữ liệu + phiên đăng nhập)
   ├─ components/             Header, Banner, DocCard, docArt, AuthModal, QrModal, Toast…
   ├─ pages/                  Library, Roadmap, ComingSoon, MyLibrary
   ├─ admin/                  AdminLayout, Dashboard, DocsAdmin, StagesAdmin, UsersAdmin, SettingsAdmin
   └─ styles/                 legacy.css (giữ giao diện gốc), app.css, admin.css
```

---

## 4. Kế hoạch triển khai
| Giai đoạn | Việc | Kết quả |
|---|---|---|
| 0. Môi trường | Node ≥ 18, `npm install`, `npm run dev` | Chạy local tại http://localhost:5173 |
| 1. Tách dữ liệu | `scripts/extract.mjs` lấy CSS, 17 ảnh, 40 tài liệu, 9 chặng, 3 dụng cụ, 3 app, 6 prompt | `seed.json`, `public/assets` |
| 2. Giao diện công khai | Header, menu, banner, Kho tài liệu, Lộ trình (đủ tính năng mục 1.2) | Giống bản gốc |
| 3. Tài khoản | Đăng ký/đăng nhập, menu tài khoản, lưu tiến độ, Kho của tôi | |
| 4. CMS | Tổng quan, Tài liệu, Lộ trình, Tài khoản, Cài đặt, Sao lưu | `#/admin` |
| 5. Backend dùng chung (tuỳ chọn) | Tạo project Supabase free, chạy `docs/supabase.sql`, đặt `VITE_BACKEND=supabase` | Nhiều người dùng chung dữ liệu |
| 6. Triển khai | `npm run build` → đẩy thư mục `dist/` lên GitHub Pages / Netlify | Web công khai miễn phí |
| 7. Mở rộng sau | Trang Ôn tập (flashcard, quiz), Cộng đồng (bình luận), thông báo | |

## 5. Cài đặt & chạy
```bash
npm install
npm run dev          # phát triển
npm run build        # build ra dist/
npm run preview      # xem bản build
```
Không cài được Vite? Dùng `npm run build:esbuild` (chỉ cần react, react-dom, esbuild).

Tài khoản quản trị mặc định (bản local): **admin@mot.vn / admin123** — đổi mật khẩu ngay sau lần đăng nhập đầu.

## 6. Rủi ro & lưu ý
- Bản `local` lưu dữ liệu trong từng trình duyệt: tài khoản người khác đăng ký sẽ không thấy được ở máy admin. Muốn dùng thật cho nhiều người → bật Supabase (giai đoạn 5).
- Link tài liệu trỏ Google Drive: quyền chia sẻ phải là “Bất kỳ ai có đường liên kết”.
- Link affiliate đang để trống trong file gốc → nhập trong CMS › Cài đặt.
- Ảnh QR là thông tin chuyển khoản thật; kiểm tra lại trước khi công khai.

---

## Cập nhật: Đăng nhập bằng Google

Nút **“Tiếp tục với Google”** hiện trong hộp Đăng nhập / Tạo tài khoản khi đã cấu hình một trong hai cách dưới đây (chưa cấu hình thì nút tự ẩn, đăng nhập email vẫn chạy bình thường). Cả hai đều miễn phí.

**Cách A: Supabase (nên dùng khi chạy thật)**
1. Google Cloud Console › APIs & Services › Credentials › *Create OAuth client ID* › loại **Web application**.
   - *Authorized redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase › Authentication › Providers › **Google** › bật, dán Client ID + Client Secret.
3. Supabase › Authentication › URL Configuration › thêm địa chỉ web của bạn (vd. `https://mot.pages.dev/`, `http://localhost:5173/`) vào *Redirect URLs*.
4. Chạy lại `docs/supabase.sql` (đã thêm cột `avatar`, `provider`; chạy lại không mất dữ liệu).

Bấm nút → chuyển sang Google → quay về đúng trang đang xem, đã đăng nhập. Người mới được tạo hồ sơ vai trò *Học viên*, lấy tên + ảnh đại diện từ Google.

**Cách B: chế độ lưu trên trình duyệt**
1. Tạo OAuth client ID loại **Web application** như trên, nhưng điền *Authorized JavaScript origins* = địa chỉ web (vd. `http://localhost:5173`, `https://mot.pages.dev`). Không cần redirect URI.
2. Thêm vào `.env`: `VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com`, rồi build lại.

Lưu ý cách B: trang kiểm tra token có đúng do Google cấp cho Client ID của bạn và còn hạn, nhưng chữ ký token chỉ kiểm được ở máy chủ. Vì mọi dữ liệu vốn nằm trong trình duyệt nên cách này hợp cho bản thử; khi có nhiều người dùng thật hãy dùng cách A.

**Hành vi chung**
- Email Google trùng với tài khoản email đã có → hai cách đăng nhập gộp vào cùng một tài khoản (giữ vai trò, tiến độ).
- Tài khoản chỉ có Google có thể **Tạo mật khẩu** ở “Kho của tôi” để đăng nhập thêm bằng email.
- Tài khoản bị khoá trong CMS không đăng nhập được bằng Google. CMS › Tài khoản hiện nhãn “Google”.
- Muốn tài khoản Google làm quản trị: đăng nhập bằng Google một lần, rồi admin đổi vai trò trong CMS › Tài khoản.

---

## Triển khai hiện tại

- Mã nguồn: GitHub `Tung-TV/mot-tieng-trung` (Private), nhánh `main`.
- Host: Cloudflare Pages, project `mot-tieng-trung` → https://mot-tieng-trung.pages.dev
  - Build command `npm run build`, output `dist`, Node 22 (file `.node-version`).
  - Mỗi lần đẩy code lên `main`, Cloudflare tự build và deploy lại.
- Database: Supabase project **Mọt Tiếng Trung** (`uyrolkmqiguqjpomxvsc`, gói Free, vùng eu-west-1).
  - Đã chạy `docs/supabase.sql` (bảng `content`, `profiles`, trigger, RLS).
  - Cấu hình web nằm trong `.env.production` (URL + publishable key — công khai được). `npm run dev` trên máy vẫn chạy chế độ lưu trên trình duyệt.
  - Auth › URL Configuration: Site URL `https://mot-tieng-trung.pages.dev`; Redirect URLs: `https://mot-tieng-trung.pages.dev/**`, `https://*.mot-tieng-trung.pages.dev/**`, `http://localhost:5173/**`.
  - Dữ liệu mẫu: bảng `content` trống thì web tự hiện 40 tài liệu + 9 chặng gốc; lần sửa đầu tiên trong CMS sẽ tự ghi toàn bộ dữ liệu mẫu vào database (hoặc chạy `docs/seed.sql`).
  - Admin đầu tiên: đăng ký trên web, rồi chạy trong SQL Editor: `update public.profiles set role = 'admin' where email = '...';`
- Đăng nhập Google: Google Cloud project `mot-tieng-trung`, OAuth client “Mot Tieng Trung - Supabase” (Web), trạng thái **In production**; redirect URI `https://uyrolkmqiguqjpomxvsc.supabase.co/auth/v1/callback`. Đã bật trong Supabase › Authentication › Providers › Google.
  - Trang bắt buộc cho màn hình đồng ý: `/privacy.html`, `/terms.html`.
- Quản trị viên: `kaitoshion53@gmail.com` (đăng nhập Google). Cấp quyền cho người khác trong CMS › Tài khoản.
