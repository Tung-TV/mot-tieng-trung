import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { useRoute } from './router.jsx';
import { Header, TopNav, Banner } from './components/Header.jsx';
import { AuthModal, ConfirmDialog, Toasts } from './components/Overlays.jsx';
import Library from './pages/Library.jsx';
import Roadmap from './pages/Roadmap.jsx';
import MyLibrary from './pages/MyLibrary.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import AdminLayout from './admin/AdminLayout.jsx';

const TITLES = { '/': 'Kho tài liệu', '/lo-trinh': 'Lộ trình học', '/kho-cua-toi': 'Kho của tôi', '/on-tap': 'Ôn tập', '/cong-dong': 'Cộng đồng' };

function Shell() {
  const { content, error } = useApp();
  const path = useRoute();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');

  useEffect(() => {
    document.title = 'Mọt Tiếng Trung - ' + (isAdmin ? 'Quản trị' : TITLES[path] || 'Kho tài liệu');
    if (!isAdmin) window.scrollTo(0, 0);
  }, [path, isAdmin]);

  if (error) return <div className="page"><section className="sk soon"><div className="soon-e">⚠️</div><h2>Không tải được dữ liệu</h2><p>{error}</p><div className="soon-a"><button className="btn-p" type="button" onClick={() => location.reload()}>Thử lại</button></div></section></div>;
  if (!content) return <div className="boot"><img src="assets/logo.jpg" alt="" /><span>Đang tải…</span></div>;

  let page;
  if (isAdmin) page = <AdminLayout path={path} />;
  else if (path === '/') page = <Library />;
  else if (path === '/lo-trinh') page = <Roadmap />;
  else if (path === '/kho-cua-toi') page = <MyLibrary />;
  else page = <ComingSoon path={path} />;

  return (
    <div className={'page' + (isAdmin ? ' page-adm' : '')}>
      <Header />
      {!isAdmin && <TopNav path={path} />}
      {!isAdmin && (path === '/' || path === '/lo-trinh') && <Banner />}
      {page}
      {!isAdmin && <footer className="foot">© {new Date().getFullYear()} Mọt Tiếng Trung · Tài liệu miễn phí cho người tự học · <a href="privacy.html">Quyền riêng tư</a> · <a href="terms.html">Điều khoản</a></footer>}
      <AuthModal />
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}
