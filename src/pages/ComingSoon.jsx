const PAGES = {
  '/on-tap': { e: '📝', t: 'Ôn tập tiếng Trung', d: 'Flashcard từ vựng theo HSK, luyện nghe, nói, đọc, viết và bài kiểm tra nhanh — đang được Mọt chuẩn bị.' },
  '/cong-dong': { e: '💬', t: 'Cộng đồng học tiếng Trung', d: 'Nơi giao lưu, hỏi đáp và chia sẻ kinh nghiệm học cùng các bạn — sắp ra mắt.' },
};

export default function ComingSoon({ path }) {
  const p = PAGES[path] || { e: '🔍', t: 'Không tìm thấy trang', d: 'Đường dẫn này không tồn tại.' };
  return (
    <section className="sk soon">
      <div className="soon-e">{p.e}</div>
      <h2>{p.t}</h2>
      <p>{p.d}</p>
      <div className="soon-a"><a className="btn-p" href="#/">Về Kho tài liệu</a><a className="btn-s" href="#/lo-trinh">Xem lộ trình học</a></div>
    </section>
  );
}
