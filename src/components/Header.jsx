import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { ROLE_LABEL, canEdit } from '../services/util.js';

const NAV = [
  { r: '/', cls: 'n1', s: '--bg1:#d6e9fd;--bg2:#b9d8f8;--tc:#1f4f9a;--sc:#c1440e', ck: '#3b82d6', b: ['KHO TÀI LIỆU', 'TIẾNG TRUNG'], sm: 'MIỄN PHÍ 100%', img: 'nav1' },
  { r: '/lo-trinh', cls: 'n2', s: '--bg1:#fde5b8;--bg2:#fbd08a;--tc:#b3541a;--sc:#5a3a1a', ck: '#f0a030', b: ['LỘ TRÌNH HỌC', 'TIẾNG TRUNG'], sm: 'DÀNH CHO NGƯỜI MỚI', img: 'nav2' },
  { r: '/on-tap', cls: 'n3', s: '--bg1:#d8f3d3;--bg2:#bde8b6;--tc:#1f7a2f;--sc:#2f5d34', ck: '#3fae49', b: ['ÔN TẬP', 'TIẾNG TRUNG'], sm: 'Luyện từ vựng, nghe, nói, đọc, viết', img: 'nav3' },
  { r: '/cong-dong', cls: 'n4', s: '--bg1:#f1dcf8;--bg2:#e4c3f1;--tc:#7b2f9c;--sc:#7b2f9c', ck: '#a855c7', b: ['CỘNG ĐỒNG', 'HỌC TIẾNG TRUNG'], sm: 'GIAO LƯU & CHIA SẺ', img: 'nav4' },
];
const styleObj = (s) => Object.fromEntries(s.split(';').map((x) => x.split(':')));

export function Header() {
  const { user, auth, setAuthOpen, content } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const img = content.settings.images;

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, []);
  const go = (fn) => () => { setOpen(false); fn(); };

  return (
    <header className="topbar">
      <a className="brand" href="#/" aria-label="Mọt Tiếng Trung - Trang chủ"><img src={img.logo} alt="Mọt Tiếng Trung - Kho tài liệu tự học" /></a>
      <div className="acct">
        <a className="com" href="#/cong-dong">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><circle cx="17" cy="9" r="2.4" /><path d="M17.5 14.2c2.2.3 3.5 2 3.5 4.3" /></svg>
          Cộng đồng
        </a>
        <button className="bell" type="button" aria-label="Thông báo" title="Thông báo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 004 0" /></svg>
          <i className="dot" />
        </button>
        <div className="me" ref={ref}>
          <button className={'avatar' + (user ? ' in' : '')} type="button" aria-haspopup="true" aria-expanded={open} aria-label="Tài khoản" onClick={() => setOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="#8a6a3a" aria-hidden="true"><circle cx="12" cy="8.5" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" /></svg>
            <span className="ini">{user ? (user.name || '?').trim().charAt(0).toUpperCase() : ''}</span>
            {user && user.avatar && <img className="pic" src={user.avatar} alt="" referrerPolicy="no-referrer" />}
          </button>
          {open && (
            <div className="menu">
              {user ? (
                <>
                  <b>Xin chào, {user.name}!<small className="role-tag">{ROLE_LABEL[user.role]}</small></b>
                  <button type="button" onClick={go(() => navigate('/kho-cua-toi'))}>📚 Kho của tôi</button>
                  {canEdit(user) && <button type="button" onClick={go(() => navigate('/admin'))}>🛠️ Trang quản trị (CMS)</button>}
                  <button type="button" onClick={go(() => auth.logout())}>Đăng xuất</button>
                </>
              ) : (
                <>
                  <b>Bạn chưa đăng nhập</b>
                  <button type="button" onClick={go(() => setAuthOpen('login'))}>Đăng nhập</button>
                  <button type="button" onClick={go(() => setAuthOpen('register'))}>Tạo tài khoản</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function TopNav({ path }) {
  const { content } = useApp();
  const img = content.settings.images;
  return (
    <nav className="topnav" aria-label="Chuyên mục">
      {NAV.map((n) => (
        <a key={n.r} className={'nv ' + n.cls + (path === n.r ? ' on' : '')} href={'#' + n.r} style={styleObj(n.s)}>
          <i className="ck" style={{ background: n.ck }}>✓</i>
          <span><b>{n.b[0]}<br />{n.b[1]}</b><small>{n.sm}</small></span>
          <img src={img[n.img]} alt="" />
        </a>
      ))}
    </nav>
  );
}

export function Banner() {
  const { content } = useApp();
  return (
    <section className="banner" aria-label="Mọt Tiếng Trung">
      <img src={content.settings.images.banner} alt="Mọt Tiếng Trung: 17 tuổi tự học tiếng Trung, đỗ HSK5" />
      <div className="cap1"><span>Từ 1 đứa không biết</span><em>một chữ Tiếng Trung nào,</em></div>
      <div className="cap2">Mình đã <mark>Tự tin Giao tiếp</mark><br />Tiếng Trung chỉ sau <mark>6 tháng...</mark></div>
    </section>
  );
}
