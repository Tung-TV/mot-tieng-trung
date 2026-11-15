import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../services/store.js';
import { tierOf } from '../services/model.js';
import { navigate, currentPath } from '../router.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const GUEST_KEY = 'mot.guest.progress';
const KICKED = 'Tài khoản của bạn vừa đăng nhập trên thiết bị khác, nên đã tự đăng xuất ở thiết bị này. Mỗi tài khoản chỉ dùng được trên 1 thiết bị cùng lúc. Nếu không phải bạn đăng nhập, hãy đổi mật khẩu ngay.';
const readGuest = () => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}'); } catch { return {}; } };

export function AppProvider({ children }) {
  const [content, setContent] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [authOpen, setAuthOpen] = useState(null); // 'login' | 'register' | null
  const [libQuery, setLibQuery] = useState(''); // từ khoá chuyển từ trang Lộ trình sang Kho
  const [guest, setGuest] = useState(readGuest);
  const [upgradeOpen, setUpgradeOpen] = useState(false); // hộp “Cần nâng cấp tài khoản”
  const [dialog, setDialog] = useState(null); // hộp xác nhận trong trang (thay window.confirm/prompt)
  const ask = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const toast = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const reload = useCallback(async () => { setContent(await store.getContent()); }, []);

  // Mỗi tài khoản chỉ 1 thiết bị: phiên ở đây đã bị thay bởi lần đăng nhập ở thiết bị khác
  const kicked = useCallback(async () => {
    setUser(null);
    try { await reload(); } catch { /* */ }
    if (currentPath().startsWith('/admin')) navigate('/');
    const again = await ask({ title: 'Bạn đã bị đăng xuất', message: KICKED, ok: 'Đăng nhập lại', cancel: 'Đóng' });
    if (again) setAuthOpen('login');
  }, [reload, ask]);

  useEffect(() => {
    (async () => {
      try {
        await store.init(); await reload();
        let u = await store.currentUser();
        if (store.checkSession && !(await store.checkSession())) { u = null; kicked(); }
        setUser(u);
        const ae = store.takeAuthError && store.takeAuthError();
        if (ae) toast(ae, 'err'); else if (u && sessionStorage.getItem('mot.welcome')) { toast('Đăng nhập thành công. Chào ' + u.name + '!'); if (tierOf(u) === 'staff') navigate('/admin'); }
        try { sessionStorage.removeItem('mot.welcome'); } catch { /* */ }
      }
      catch (e) { setError(e.message || String(e)); }
    })();
  }, [reload, toast, kicked]);

  // Kiểm tra lại phiên khi quay lại tab/cửa sổ và mỗi phút (quản trị/biên tập được miễn)
  const uid = user && user.id, staff = tierOf(user) === 'staff';
  useEffect(() => {
    if (!uid || staff || !store.checkSession) return undefined;
    let busy = false;
    const check = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { if (!(await store.checkSession())) kicked(); } finally { busy = false; }
    };
    const onVis = () => { if (!document.hidden) check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(check, 60000);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', onVis); clearInterval(t); };
  }, [uid, staff, kicked]);

  // Chạy một thao tác ghi, báo lỗi bằng toast, tải lại dữ liệu
  const run = useCallback(async (fn, okMsg) => {
    try { const r = await fn(); await reload(); if (okMsg) toast(okMsg); return r; }
    catch (e) { toast(e.message || 'Có lỗi xảy ra', 'err'); throw e; }
  }, [reload, toast]);

  const progress = user ? user.progress || {} : guest;
  const setProgress = useCallback(async (patch) => {
    if (user) setUser(await store.updateProgress(patch));
    else setGuest((g) => { const n = { ...g, ...patch }; try { localStorage.setItem(GUEST_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
  }, [user]);

  // đổi tài khoản → nội dung được phép xem cũng đổi (học viên thấy chi tiết lộ trình, thành viên thì không)
  const afterLogin = useCallback(async (u, msg) => {
    await reload(); setUser(u); toast(msg); // tải nội dung đúng quyền trước rồi mới đổi tài khoản
    if (tierOf(u) === 'staff' && !currentPath().startsWith('/admin')) navigate('/admin'); // quản trị vào thẳng trang quản lý
    return u;
  }, [reload, toast]);

  const auth = useMemo(() => ({
    async login(data) { const u = await store.login(data); return afterLogin(u, 'Đăng nhập thành công. Chào ' + u.name + '!'); },
    // Supabase: chuyển trang sang Google (không trả về). Bản trình duyệt: nhận credential từ nút Google.
    async google(credential) {
      if (store.googleMode === 'redirect') { try { sessionStorage.setItem('mot.welcome', '1'); } catch { /* */ } }
      const u = await store.loginWithGoogle(credential); return afterLogin(u, 'Đăng nhập Google thành công. Chào ' + u.name + '!');
    },
    async register(data) { const u = await store.register(data); return afterLogin(u, 'Tạo tài khoản thành công!'); },
    async logout() { await store.logout(); setUser(null); await reload(); toast('Đã đăng xuất.'); if (currentPath().startsWith('/admin')) navigate('/'); },
    async refreshUser() { const u = await store.currentUser(); await reload(); setUser(u); return u; },
  }), [toast, reload, afterLogin]);

  const value = { store, content, user, setUser, error, reload, run, toast, toasts, auth, authOpen, setAuthOpen, libQuery, setLibQuery, progress, setProgress, ask, dialog, setDialog, tier: tierOf(user), upgradeOpen, setUpgradeOpen };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
