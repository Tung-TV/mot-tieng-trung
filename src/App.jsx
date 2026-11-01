import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { isLegacy, useRoute } from './router.jsx';
import LegacyView from './pages/LegacyView.jsx';
import Lesson from './pages/Lesson.jsx';
import Course from './pages/Course.jsx';
import { Header, TopNav, Banner } from './components/Header.jsx';
import { AuthModal, ConfirmDialog, Toasts } from './components/Overlays.jsx';
import Library from './pages/Library.jsx';
import Roadmap from './pages/Roadmap.jsx';
import MyLibrary from './pages/MyLibrary.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import AdminLayout from './admin/AdminLayout.jsx';
import StageDetail from './pages/StageDetail.jsx';
import Upgrade, { UpgradeModal } from './pages/Upgrade.jsx';
import { SupportFab } from './components/Support.jsx';

const TITLES = { '/': 'Kho tài liệu', '/lo-trinh': 'Lộ trình học', '/kho-cua-toi': 'Kho của tôi', '/on-tap': 'Ôn tập', '/cong-dong': 'Cộng đồng', '/nang-cap': 'Đăng ký Khoá học', '/khoa-hoc': 'Khóa học HSK1–6', '/pinyin': 'Bảng Pinyin', '/bai-tap-pinyin': 'Bài tập Pinyin', '/thi-hsk': 'Luyện thi HSK', '/luyen-go': 'Luyện gõ từ vựng', '/shadowing': 'Luyện shadowing', '/hskk-so-cap': 'HSKK sơ cấp', '/dia-diem-thi': 'Địa điểm thi HSK' };

function Shell() {
  const { content, error } = useApp();
  const path = useRoute();
  const isAdmin = path === '/admin' || path.startsWith('/admin/');

  useEffect(() => {
    document.title = 'Mọt Tiếng Trung - ' + (isAdmin ? 'Quản trị' : TITLES[path] || (path.startsWith('/lo-trinh/') ? 'Chi tiết chặng' : /^\/bai-hoc/.test(path) ? 'Bài học' : /^\/(de-thi|lam-bai|thi-hsk)/.test(path) ? 'Thi thử HSK' : 'Kho tài liệu'));
    if (!isAdmin && !/^\/(lam-bai|de-thi)/.test(path)) window.scrollTo(0, 0);
  }, [path, isAdmin]);

  if (error) return <div className="page"><section className="sk soon"><div className="soon-e">⚠️</div><h2>Không tải được dữ liệu</h2><p>{error}</p><div className="soon-a"><button className="btn-p" type="button" onClick={() => location.reload()}>Thử lại</button></div></section></div>;
  if (!content) return <div className="boot"><img src="assets/logo.jpg" alt="" /><span>Đang tải…</span></div>;

  let page;
  if (isAdmin) page = <AdminLayout path={path} />;
  else if (path === '/') page = <Library />;
  else if (path === '/lo-trinh') page = <Roadmap />;
  else if (path.startsWith('/lo-trinh/')) page = <StageDetail id={decodeURIComponent(path.slice('/lo-trinh/'.length))} />;
  else if (path === '/kho-cua-toi') page = <MyLibrary />;
  else if (path === '/nang-cap') page = <Upgrade />;
  else if (/^\/bai-hoc\/\d+\/\d+$/.test(path)) { const [, , lv, n] = path.split('/'); page = <Lesson key={path} lv={+lv} n={+n} />; }
  else if (path === '/khoa-hoc') page = <Course />;
  else if (isLegacy(path)) page = <LegacyView path={path} />;
  else page = <ComingSoon path={path} />;

  return (
    <div className={'page' + (isAdmin ? ' page-adm' : '')}>
      <Header />
      {!isAdmin && <TopNav path={path} />}
      {!isAdmin && (path === '/' || path === '/lo-trinh') && <Banner />}
      {page}
      {!isAdmin && <footer className="foot">© {new Date().getFullYear()} Mọt Tiếng Trung · Tài liệu miễn phí cho người tự học · <a href="privacy.html">Quyền riêng tư</a> · <a href="terms.html">Điều khoản</a></footer>}
      <AuthModal />
      <UpgradeModal />
      {!isAdmin && <SupportFab />}
      <ConfirmDialog />
      <Toasts />
    </div>
  );
}

export default function App() {
  return <AppProvider><Shell /></AppProvider>;
}
