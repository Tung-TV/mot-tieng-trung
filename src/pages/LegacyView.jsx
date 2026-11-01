// Các tính năng luyện tập (Ôn tập, Pinyin, Luyện thi HSK, Luyện gõ, Shadowing, HSKK, Khoá học, Cộng đồng, Bài học)
// chạy bằng mã gốc của bản HTML, nạp khi cần từ public/legacy/ (dữ liệu nặng tách thành gói, chỉ tải khi mở đúng trang).
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';

export const LG_V = '20261101b';
let loading = null;

/** Nạp engine (một lần). bank: thông tin chuyển khoản lấy từ CMS */
export function loadLegacy(bank) {
  if (bank) window.__MOT_BANK = { name: bank.name || '', number: bank.number || '', owner: bank.owner || '', qr: bank.qr || '' };
  if (window.__lgReady) return Promise.resolve();
  if (loading) return loading;
  window.__LG_V = LG_V;
  window.__LG_BASE = 'legacy/';
  loading = new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'legacy/lg.css?v=' + LG_V;
    document.head.appendChild(css);
    window.__lgOnReady = res;
    const s = document.createElement('script');
    s.src = 'legacy/engine.js?v=' + LG_V;
    s.onerror = () => { loading = null; rej(new Error('Không tải được phần luyện tập. Kiểm tra mạng rồi thử lại nhé.')); };
    document.head.appendChild(s);
  });
  return loading;
}

function Host({ path }) {
  const { content, setLibQuery, tier } = useApp();
  // tài khoản chưa là Học viên: ẩn nút vào bài học trên trang Khoá học
  useEffect(() => { window.__lgGuest = tier !== 'student' && tier !== 'staff'; const r = document.getElementById('lg'); if (r) r.classList.toggle('lg-guest', window.__lgGuest); }, [tier, path]);
  const slot = useRef(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(!!window.__lgReady);

  useEffect(() => {
    window.__motUpgrade = () => navigate('/nang-cap');
    window.__motLib = (k) => { setLibQuery && setLibQuery(k); navigate('/'); };
  }, [setLibQuery]);

  useEffect(() => {
    let alive = true, r = null;
    loadLegacy(content.settings.bank).then(() => {
      if (!alive) return;
      r = document.getElementById('lg');
      if (r && slot.current) { slot.current.appendChild(r); r.classList.add('on'); r.classList.toggle('lg-guest', !!window.__lgGuest); }
      setReady(true);
      window.__lgRoute && window.__lgRoute();
    }, (e) => alive && setErr(e.message));
    return () => { alive = false; if (r) { r.classList.remove('on'); document.body.appendChild(r); } };
  }, [content.settings.bank]);

  useEffect(() => { if (ready && window.__lgRoute) window.__lgRoute(); }, [path, ready]);

  return (
    <div className="lg-slot" ref={slot}>
      {!ready && !err && <div className="lg-load"><span className="spin" />Đang tải phần luyện tập…</div>}
      {err && <section className="sk soon"><div className="soon-e">⚠️</div><h2>Chưa tải được</h2><p>{err}</p><div className="soon-a"><button className="btn-p" type="button" onClick={() => location.reload()}>Thử lại</button></div></section>}
    </div>
  );
}

export default function LegacyView({ path }) {
  return <Host path={path} />;
}
