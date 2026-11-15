// Chuông thông báo: chấm đỏ + số chưa đọc, bấm mở danh sách. Đã đọc lưu theo tài khoản (progress.notiSeen) nên đồng bộ mọi thiết bị;
// khách chưa đăng nhập thì lưu trên trình duyệt.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { buildNotifications } from '../services/notifications.js';

const GUEST_KEY = 'mot.notiSeen';
const readGuest = () => { try { return Number(localStorage.getItem(GUEST_KEY)) || 0; } catch { return 0; } };
const ago = (t) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return Math.floor(s / 60) + ' phút trước';
  if (s < 86400) return Math.floor(s / 3600) + ' giờ trước';
  if (s < 86400 * 30) return Math.floor(s / 86400) + ' ngày trước';
  return new Date(t).toLocaleDateString('vi-VN');
};
const safe = (p) => p.catch(() => undefined);

export function NotificationBell() {
  const { store, user, content, tier, progress, setProgress } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({});
  const [guestSeen, setGuestSeen] = useState(readGuest);
  const ref = useRef(null);

  const load = useCallback(async () => {
    if (!user) return setData({});
    const [upgrade, subs, adminUpgrades, adminSubs] = await Promise.all([
      tier === 'staff' ? undefined : safe(store.myUpgrade()),
      tier === 'staff' ? undefined : safe(store.mySubmissions()),
      user.role === 'admin' ? safe(store.listUpgrades()) : undefined,
      tier === 'staff' ? safe(store.listSubmissions()) : undefined,
    ]);
    setData({ upgrade, subs, adminUpgrades, adminSubs });
  }, [store, user, tier]);

  // tải khi đăng nhập/đổi tài khoản, mỗi 2 phút, và khi quay lại tab
  useEffect(() => {
    load();
    const t = setInterval(load, 120000);
    const vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('click', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  }, []);

  const list = useMemo(() => buildNotifications({
    user, settings: content.settings,
    data: { ...data, docs: content.documents, stages: content.stages },
  }), [user, content, data]);

  const seen = user ? (progress && progress.notiSeen) || 0 : guestSeen;
  const unread = list.filter((n) => n.at > seen).length;

  const markSeen = () => {
    const t = Date.now();
    if (user) setProgress({ notiSeen: t }).catch?.(() => {});
    else { try { localStorage.setItem(GUEST_KEY, String(t)); } catch { /* */ } setGuestSeen(t); }
  };
  const toggle = () => {
    const next = !open; setOpen(next);
    if (next) { load(); }
    else if (unread) markSeen();
  };
  const go = (n) => { setOpen(false); markSeen(); if (n.to) navigate(n.to); };

  return (
    <div className="noti" ref={ref}>
      <button className="bell" type="button" aria-label={unread ? 'Thông báo, ' + unread + ' chưa đọc' : 'Thông báo'} title="Thông báo" aria-haspopup="true" aria-expanded={open} onClick={toggle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 004 0" /></svg>
        {unread > 0 && <i className="dot cnt">{unread > 9 ? '9+' : unread}</i>}
      </button>
      {open && (
        <div className="noti-p" role="dialog" aria-label="Thông báo">
          <div className="noti-h"><b>Thông báo</b>{unread > 0 && <button type="button" className="lnkbtn" onClick={markSeen}>Đánh dấu đã đọc</button>}</div>
          {list.length ? (
            <ul>
              {list.map((n) => (
                <li key={n.id} className={'t-' + n.tone + (n.at > seen ? ' new' : '')}>
                  <button type="button" onClick={() => go(n)} disabled={!n.to}>
                    <span className="ic" aria-hidden="true">{n.icon}</span>
                    <span className="tx"><b>{n.title}</b>{n.body && <span>{n.body}</span>}<small>{n.at ? ago(n.at) : ''}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="noti-e">🔔 Chưa có thông báo nào.<br />Mọt sẽ báo khi có tài liệu mới, kết quả bài kiểm tra hay thay đổi về gói học.</p>}
        </div>
      )}
    </div>
  );
}
