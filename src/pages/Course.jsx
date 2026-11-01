// Trang giới thiệu Khoá học Mọt Tiếng Trung HSK1–6 (gói Học viên)
import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { DEFAULT_PLAN, fmtVnd, lessonState, stageLevel } from '../services/model.js';
import { LessonList } from '../components/StageParts.jsx';
import { TABS } from './Lesson.jsx';

const PARTS = [['🎬', 'Video bài giảng', 'Xem ngay trên web, ghim video khi cuộn để vừa xem vừa ôn'], ...TABS.map(([, e, t]) => [e, t, {
  'Luyện viết': 'Xem thứ tự nét từng chữ rồi tự viết, máy chấm nét',
  'Từ vựng': 'Danh sách từ có phiên âm, nghĩa, câu ví dụ, lật thẻ ghi nhớ',
  'Nghe hiểu': 'Nghe từ và chọn nghĩa đúng, luyện phản xạ tai nghe',
  'Ngữ pháp': 'Điểm ngữ pháp kèm ví dụ có giọng đọc và bài tập',
  'Luyện nói': 'Nói theo câu mẫu, máy nhận giọng và chấm độ giống',
}[t]])];
const FAQ = [
  ['Học trên thiết bị nào?', 'Máy tính, điện thoại, máy tính bảng — chỉ cần trình duyệt. Tiến độ lưu theo tài khoản nên đổi thiết bị vẫn học tiếp đúng chỗ.'],
  ['Đăng ký thế nào?', 'Bấm Đăng ký, hệ thống tạo mã giao dịch và mã QR có sẵn số tiền. Chuyển khoản ghi đúng mã, admin xác nhận là tài khoản thành Học viên.'],
  ['Có học thử không?', 'Có. Bài 1 mỗi cấp và các chặng có nhãn Miễn phí học được ngay, không cần đăng ký.'],
  ['Lộ trình và kho tài liệu có mất phí không?', 'Không. Danh sách lộ trình, kho tài liệu miễn phí và phần Ôn tập vẫn mở cho mọi người.'],
];

function LevelCard({ s }) {
  const { progress, tier } = useApp();
  const [open, setOpen] = useState(false);
  const lv = stageLevel(s), n = (s.lessons || []).length;
  const done = (s.lessons || []).filter((_, i) => lessonState(progress, lv + '-' + (i + 1)) === 'done').length;
  const paid = tier === 'student' || tier === 'staff';
  return (
    <article className="kc-lv" style={{ '--c': s.color }}>
      <div className="kc-lv-top">
        {s.cover ? <img src={s.cover} alt={'Giáo trình ' + s.title} loading="lazy" /> : <span className="kc-lv-e">{s.emoji}</span>}
        <div>
          <span className="kc-lv-k">{s.emoji} {s.key}</span>
          <h3>{s.title}</h3>
          <p>{s.desc}</p>
          <div className="kc-lv-m">
            <span>📖 {n} bài</span>
            {(s.info || []).filter((r) => r[0] !== 'Giáo trình').slice(0, 2).map((r) => <span key={r[0]}>{r[1].replace(/ theo Đại cương HSK mới/, '')}</span>)}
            {(s.freeLessons || []).length > 0 && !paid && <span className="kc-free">🎁 Học thử bài {s.freeLessons.join(', ')}</span>}
          </div>
          {paid && n > 0 && <div className="kc-prog"><div className="bar"><i style={{ width: Math.round((done / n) * 100) + '%' }} /></div><small>Đã học xong {done}/{n} bài</small></div>}
        </div>
      </div>
      <button type="button" className="btn-s kc-more" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Thu gọn ▴' : 'Xem ' + n + ' bài học ▾'}</button>
      {open && <LessonList s={s} open />}
    </article>
  );
}

export default function Course() {
  const { content, tier, progress } = useApp();
  const plan = content.settings.plan || DEFAULT_PLAN;
  const levels = content.stages.filter((s) => stageLevel(s) && (s.lessons || []).length);
  const total = levels.reduce((n, s) => n + s.lessons.length, 0);
  const paid = tier === 'student' || tier === 'staff';
  const perDay = plan.months > 0 ? Math.round(plan.price / (plan.months * 30.4) / 100) / 10 : 0;
  const last = progress.lastLesson;
  const firstFree = levels.find((s) => (s.freeLessons || []).length);
  const cta = paid
    ? <button type="button" className="btn-p kc-cta" onClick={() => navigate(last ? '/bai-hoc/' + last.replace('-', '/') : '/bai-hoc/1/1')}>▶ {last ? 'Tiếp tục học' : 'Bắt đầu học'}</button>
    : <button type="button" className="btn-p kc-cta" onClick={() => navigate('/nang-cap')}>🎓 Đăng ký · {fmtVnd(plan.price)}{plan.months ? ' / ' + (plan.months === 12 ? 'năm' : plan.months + ' tháng') : ''}</button>;
  return (
    <div className="kc">
      <section className="kc-hero">
        <div className="kc-hero-l">
          <span className="kc-badge">KHOÁ HỌC MỌT TIẾNG TRUNG</span>
          <h1>Trọn bộ <mark>HSK 1–6</mark><br />học là đỗ HSK</h1>
          <p>Học theo giáo trình chuẩn HSK 3.0: mỗi bài có video bài giảng ngay trên web và 5 phần ôn tập — viết, từ vựng, nghe, ngữ pháp, nói. Học đến đâu, Mọt nhớ tiến độ đến đó.</p>
          <div className="kc-stats"><span><b>{levels.length}</b> cấp</span><span><b>{total}</b> bài học</span><span><b>6</b> phần mỗi bài</span></div>
          <div className="row-btns">
            {cta}
            {!paid && firstFree && <button type="button" className="btn-s" onClick={() => navigate('/bai-hoc/' + stageLevel(firstFree) + '/' + firstFree.freeLessons[0])}>Học thử miễn phí</button>}
          </div>
        </div>
        <div className="kc-price">
          <small>TRỌN BỘ HSK 1–6</small>
          <b>{fmtVnd(plan.price)}</b>
          <span>{plan.months ? (plan.months === 12 ? '/ năm' : '/ ' + plan.months + ' tháng') : 'trọn đời'}</span>
          {perDay > 0 && <em>≈ chỉ {perDay.toLocaleString('vi-VN')}K / ngày</em>}
          <ul>{(plan.benefits || []).map((b, i) => <li key={i}>{b}</li>)}</ul>
          {paid ? <span className="kc-on">✓ Bạn đang là Học viên</span> : <button type="button" className="btn-p" onClick={() => navigate('/nang-cap')}>Đăng ký ngay</button>}
        </div>
      </section>

      <section className="sk kc-sec">
        <h2>Mỗi bài học có gì?</h2>
        <div className="kc-parts">{PARTS.map(([e, t, d]) => <div key={t} className="kc-part"><i>{e}</i><b>{t}</b><span>{d}</span></div>)}</div>
      </section>

      <section className="kc-sec">
        <h2>Chương trình học</h2>
        <div className="kc-lvs">{levels.map((s) => <LevelCard key={s.id} s={s} />)}</div>
      </section>

      {!paid && (
        <section className="sk kc-sec">
          <h2>Đăng ký trong 3 bước</h2>
          <ol className="kc-steps">
            <li><b>Tạo mã giao dịch</b><span>Đăng nhập, bấm Đăng ký để nhận mã riêng và mã QR có sẵn số tiền.</span></li>
            <li><b>Chuyển khoản</b><span>Ghi đúng mã giao dịch vào nội dung chuyển khoản, rồi bấm “Tôi đã chuyển khoản”.</span></li>
            <li><b>Vào học</b><span>Admin xác nhận, tài khoản thành Học viên — mở toàn bộ bài học ngay.</span></li>
          </ol>
        </section>
      )}

      <section className="sk kc-sec">
        <h2>Câu hỏi thường gặp</h2>
        {FAQ.map(([q, a]) => <details key={q} className="dd kc-faq"><summary>{q}</summary><div>{a}</div></details>)}
      </section>

      {!paid && <div className="kc-sticky"><span><b>{fmtVnd(plan.price)}</b>{plan.months === 12 ? ' / năm' : ''} · trọn bộ HSK 1–6</span>{cta}</div>}
    </div>
  );
}
