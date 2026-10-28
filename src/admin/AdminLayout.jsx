import { useApp } from '../context/AppContext.jsx';
import { canEdit, isAdmin, ROLE_LABEL } from '../services/util.js';
import Dashboard from './Dashboard.jsx';
import DocsAdmin from './DocsAdmin.jsx';
import StagesAdmin from './StagesAdmin.jsx';
import UsersAdmin from './UsersAdmin.jsx';
import SettingsAdmin from './SettingsAdmin.jsx';
import BackupAdmin from './BackupAdmin.jsx';

const MENU = [
  { p: '/admin', l: '📊 Tổng quan', c: Dashboard },
  { p: '/admin/tai-lieu', l: '📄 Tài liệu', c: DocsAdmin },
  { p: '/admin/lo-trinh', l: '🪜 Lộ trình học', c: StagesAdmin },
  { p: '/admin/tai-khoan', l: '👥 Tài khoản', c: UsersAdmin, admin: true },
  { p: '/admin/cai-dat', l: '⚙️ Cài đặt', c: SettingsAdmin, admin: true },
  { p: '/admin/sao-luu', l: '💾 Sao lưu', c: BackupAdmin, admin: true },
];

export default function AdminLayout({ path }) {
  const { user, setAuthOpen, store } = useApp();
  if (!canEdit(user)) {
    return (
      <section className="sk soon">
        <div className="soon-e">🔒</div>
        <h2>Trang quản trị</h2>
        <p>{user ? 'Tài khoản của bạn không có quyền vào CMS. Liên hệ quản trị viên để được cấp quyền Biên tập.' : 'Vui lòng đăng nhập bằng tài khoản Quản trị hoặc Biên tập.'}</p>
        {!user && <div className="soon-a"><button className="btn-p" type="button" onClick={() => setAuthOpen('login')}>Đăng nhập</button></div>}
        {!user && store.kind === 'local' && <p className="muted">Bản demo: <code>admin@mot.vn</code> / <code>admin123</code></p>}
      </section>
    );
  }
  const items = MENU.filter((m) => !m.admin || isAdmin(user));
  const cur = items.find((m) => m.p === path) || (MENU.some((m) => m.p === path) ? null : items[0]);
  const Page = cur ? cur.c : null;
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-me"><b>{user.name}</b><small>{ROLE_LABEL[user.role]} · {store.kind === 'local' ? 'Lưu trên trình duyệt' : 'Supabase'}</small></div>
        <nav>{items.map((m) => <a key={m.p} href={'#' + m.p} className={cur && cur.p === m.p ? 'on' : ''}>{m.l}</a>)}</nav>
        <a className="adm-back" href="#/">‹ Về trang chính</a>
      </aside>
      <main className="adm-main">{Page ? <Page /> : <p>Bạn không có quyền xem mục này.</p>}</main>
    </div>
  );
}
