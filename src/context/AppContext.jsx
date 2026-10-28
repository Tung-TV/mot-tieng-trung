import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { store } from '../services/store.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const GUEST_KEY = 'mot.guest.progress';
const readGuest = () => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) || '{}'); } catch { return {}; } };

export function AppProvider({ children }) {
  const [content, setContent] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState([]);
  const [authOpen, setAuthOpen] = useState(null); // 'login' | 'register' | null
  const [libQuery, setLibQuery] = useState(''); // từ khoá chuyển từ trang Lộ trình sang Kho
  const [guest, setGuest] = useState(readGuest);
  const [dialog, setDialog] = useState(null); // hộp xác nhận trong trang (thay window.confirm/prompt)
  const ask = useCallback((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), []);

  const toast = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const reload = useCallback(async () => { setContent(await store.getContent()); }, []);

  useEffect(() => {
    (async () => {
      try {
        await store.init(); await reload();
        const u = await store.currentUser(); setUser(u);
        const ae = store.takeAuthError && store.takeAuthError();
        if (ae) toast(ae, 'err'); else if (u && sessionStorage.getItem('mot.welcome')) toast('Đăng nhập thành công. Chào ' + u.name + '!');
        try { sessionStorage.removeItem('mot.welcome'); } catch { /* */ }
      }
      catch (e) { setError(e.message || String(e)); }
    })();
  }, [reload, toast]);

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

  const auth = useMemo(() => ({
    async login(data) { const u = await store.login(data); setUser(u); toast('Đăng nhập thành công. Chào ' + u.name + '!'); return u; },
    // Supabase: chuyển trang sang Google (không trả về). Bản trình duyệt: nhận credential từ nút Google.
    async google(credential) {
      if (store.googleMode === 'redirect') { try { sessionStorage.setItem('mot.welcome', '1'); } catch { /* */ } }
      const u = await store.loginWithGoogle(credential); setUser(u); toast('Đăng nhập Google thành công. Chào ' + u.name + '!'); return u;
    },
    async register(data) { const u = await store.register(data); setUser(u); toast('Tạo tài khoản thành công!'); return u; },
    async logout() { await store.logout(); setUser(null); toast('Đã đăng xuất.'); },
    async refreshUser() { setUser(await store.currentUser()); },
  }), [toast]);

  const value = { store, content, user, setUser, error, reload, run, toast, toasts, auth, authOpen, setAuthOpen, libQuery, setLibQuery, progress, setProgress, ask, dialog, setDialog };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
