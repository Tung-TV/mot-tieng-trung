# Chuyển các tính năng luyện tập từ bản HTML gốc

Các trang Ôn tập, Bảng Pinyin, Luyện thi HSK, Luyện gõ, Shadowing, HSKK, Khoá học, Cộng đồng và trang Bài học
chạy bằng mã gốc của file `mottiengtrung.html`, được tách thành:

- `public/legacy/engine.js`: phần mã + dữ liệu nhẹ (~0,5 MB), nạp khi mở trang luyện tập đầu tiên
- `public/legacy/c-*.js`: dữ liệu nặng, chỉ tải khi cần (`ex1..ex6` đề thi thử theo cấp, `vocab` từ vựng, `gram` ngữ pháp, `wr*` chữ Hán luyện viết)
- `public/legacy/lg.css`: CSS gốc, đã gói trong `#lg` để không đè lên giao diện React

Khi có bản HTML mới: tách các thẻ `<script>` ra `x/s0.js … s5.js` và CSS ra `x/orig.css`, rồi chạy

```
node scripts/legacy/split.cjs x public/legacy duong-dan/mottiengtrung.html
python3 scripts/legacy/scope.py x/orig.css public/legacy/lg.css   # rồi thêm lại đoạn “vá khi nhúng” ở cuối
```

(cần `acorn` trong NODE_PATH). Nhớ đổi `LG_V` trong `src/pages/LegacyView.jsx` để trình duyệt tải bản mới.
