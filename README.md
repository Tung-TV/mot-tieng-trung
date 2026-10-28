# Mọt Tiếng Trung — Kho tài liệu & Lộ trình học (React + CMS)

Bản React của trang “Mọt Tiếng Trung - Kho tài liệu”, có thêm tài khoản người dùng và trang quản trị (CMS). Chi phí: 0đ.

## Chạy thử

```bash
npm install
npm run dev          # http://localhost:5173
```

Đăng nhập CMS (bản demo): `admin@mot.vn` / `admin123` → menu avatar › “Trang quản trị”, hoặc mở `#/admin`.
**Đổi mật khẩu ngay** ở “Kho của tôi” sau lần đăng nhập đầu tiên.

## Build & deploy miễn phí

```bash
npm run build        # Vite → dist/
# hoặc, nếu không cài được Vite:
npm run build:esbuild
```

Đưa thư mục `dist/` lên GitHub Pages / Netlify / Cloudflare Pages / Vercel (đều có gói miễn phí). Trang dùng đường dẫn `#/...` nên không cần cấu hình rewrite.

## Hai chế độ lưu dữ liệu

| Chế độ | Bật bằng | Ưu | Nhược |
|---|---|---|---|
| **Trình duyệt** (mặc định) | không cần gì | 0 cấu hình, chạy offline | Sửa trên CMS chỉ có ở máy đó — muốn công bố: CMS › Sao lưu › “Tải content.json”, chép vào `public/`, build lại |
| **Supabase** (gói Free) | `.env`: `VITE_BACKEND=supabase` + URL + anon key; chạy `docs/supabase.sql` | Nhiều người dùng thật, CMS sửa là mọi người thấy ngay | Cần tạo project Supabase |

Chi tiết phân tích chức năng, mô hình dữ liệu, phân quyền và lộ trình phát triển: xem **PLAN.md**.

## Đăng nhập bằng Google

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

## Trang

| Đường dẫn | Nội dung |
|---|---|
| `#/` | Kho tài liệu: tìm kiếm, lọc định dạng, sắp xếp, phân trang, lưu ❤, ủng hộ QR |
| `#/lo-trinh` | Lộ trình 9 chặng, bậc thang, đánh dấu chặng xong, túi đồ nghề, app học |
| `#/kho-cua-toi` | Tài liệu đã lưu, tiến độ, đổi tên / mật khẩu |
| `#/admin` | CMS: Tổng quan · Tài liệu · Lộ trình · Tài khoản · Cài đặt · Sao lưu |

Vai trò: **Quản trị** (toàn quyền) · **Biên tập** (tài liệu + lộ trình) · **Học viên** (lưu tài liệu, tiến độ).

## Cấu trúc

```
src/
  services/   store.js (chọn backend) · localAdapter.js · supabaseAdapter.js · seed.js
  context/    AppContext.jsx (dữ liệu, đăng nhập, tiến độ, toast)
  pages/      Library · Roadmap · MyLibrary · ComingSoon
  admin/      AdminLayout · Dashboard · DocsAdmin · StagesAdmin · UsersAdmin · SettingsAdmin · BackupAdmin
  components/ Header · DocCard · DonateBox · Overlays · docArt (ảnh bìa SVG)
  styles/     legacy.css (CSS gốc) · app.css · admin.css
scripts/      extract.mjs (tách dữ liệu + ảnh từ file HTML gốc) · build.mjs (build bằng esbuild)
```
