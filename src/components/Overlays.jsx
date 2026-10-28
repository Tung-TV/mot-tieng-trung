import { useEffect, useRef, useState } from 'react';
import { loadGis } from '../services/google.js';
import { useApp } from '../context/AppContext.jsx';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="mdl-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'mdl' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mdl-h"><b>{title}</b><button type="button" className="x" onClick={onClose} aria-label="Đóng">×</button></div>
        <div className="mdl-b">{children}</div>
      </div>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useApp();
  return <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.type}>{t.msg}</div>)}</div>;
}

export function QrModal({ src, onClose }) {
  return (
    <div className="qr-zoom" onClick={onClose} role="dialog" aria-label="Mã QR chuyển khoản (phóng to)">
      <img src={src} alt="Mã QR chuyển khoản (phóng to)" />
    </div>
  );
}

const G_LOGO = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.94 23.94 0 0 0 0 24c0 3.87.92 7.53 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Nút "Tiếp tục với Google": Supabase → chuyển trang; bản trình duyệt → nút chính chủ của Google (GIS)
function GoogleButton({ reg, onDone, onError }) {
  const { store, auth } = useApp();
  const box = useRef(null);
  const [busy, setBusy] = useState(false);
  const mode = store.googleMode;
  useEffect(() => {
    if (mode !== 'gis') return undefined;
    let alive = true;
    loadGis().then((g) => {
      if (!alive || !box.current) return;
      g.accounts.id.initialize({
        client_id: store.googleClientId,
        callback: (r) => auth.google(r.credential).then(onDone, (e) => onError(e.message)),
        ux_mode: 'popup',
      });
      box.current.innerHTML = '';
      g.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', shape: 'pill', text: reg ? 'signup_with' : 'continue_with', locale: 'vi', width: Math.min(box.current.clientWidth || 320, 400) });
    }, (e) => alive && onError(e.message));
    return () => { alive = false; };
  }, [mode, reg]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mode) return null;
  return (
    <>
      {mode === 'gis'
        ? <div className="gbtn-box" ref={box}><span className="muted">Đang tải nút Google…</span></div>
        : <button type="button" className="gbtn" disabled={busy} onClick={() => { setBusy(true); auth.google().catch((e) => { setBusy(false); onError(e.message); }); }}>{G_LOGO}<span>{busy ? 'Đang chuyển sang Google…' : 'Tiếp tục với Google'}</span></button>}
      <div className="or"><span>hoặc dùng email</span></div>
    </>
  );
}

export function AuthModal() {
  const { authOpen, setAuthOpen, auth } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!authOpen) return null;
  const reg = authOpen === 'register';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (reg) {
      if (f.name.trim().length < 2) return setErr('Vui lòng nhập họ tên.');
      if (f.password.length < 6) return setErr('Mật khẩu tối thiểu 6 ký tự.');
      if (f.password !== f.confirm) return setErr('Mật khẩu nhập lại không khớp.');
    }
    setBusy(true);
    try {
      if (reg) await auth.register({ name: f.name.trim(), email: f.email, password: f.password });
      else await auth.login({ email: f.email, password: f.password });
      setAuthOpen(null); setF({ name: '', email: '', password: '', confirm: '' });
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={reg ? 'Tạo tài khoản Mọt' : 'Đăng nhập'} onClose={() => setAuthOpen(null)}>
      <form className="form" onSubmit={submit}>
        <GoogleButton reg={reg} onDone={() => { setErr(''); setAuthOpen(null); }} onError={setErr} />
        {reg && <label>Họ tên<input value={f.name} onChange={set('name')} autoComplete="name" required /></label>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} autoComplete="email" required /></label>
        <label>Mật khẩu<input type="password" value={f.password} onChange={set('password')} autoComplete={reg ? 'new-password' : 'current-password'} required /></label>
        {reg && <label>Nhập lại mật khẩu<input type="password" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" required /></label>}
        {err && <p className="err">{err}</p>}
        <button className="btn-p" disabled={busy}>{busy ? 'Đang xử lý…' : reg ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        <p className="swap">{reg ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <button type="button" className="lnkbtn" onClick={() => { setErr(''); setAuthOpen(reg ? 'login' : 'register'); }}>{reg ? 'Đăng nhập' : 'Tạo tài khoản miễn phí'}</button>
        </p>
      </form>
    </Modal>
  );
}

// Hộp xác nhận / nhập liệu dùng chung: const ok = await ask({ title, message, danger, input })
export function ConfirmDialog() {
  const { dialog, setDialog } = useApp();
  const [val, setVal] = useState('');
  useEffect(() => { setVal(''); }, [dialog]);
  if (!dialog) return null;
  const close = (r) => { dialog.resolve(r); setDialog(null); };
  const submit = (e) => {
    e.preventDefault();
    if (dialog.input && dialog.input.minLength && val.length < dialog.input.minLength) return;
    close(dialog.input ? val : true);
  };
  return (
    <Modal title={dialog.title || 'Xác nhận'} onClose={() => close(dialog.input ? null : false)}>
      <form className="form" onSubmit={submit}>
        {dialog.message && <p className="cf-msg">{dialog.message}</p>}
        {dialog.input && <label>{dialog.input.label}<input id="cf-input" autoFocus type="text" minLength={dialog.input.minLength} value={val} onChange={(e) => setVal(e.target.value)} required /></label>}
        <div className="form-act">
          <button type="button" className="btn-s" onClick={() => close(dialog.input ? null : false)}>Huỷ</button>
          <button className={dialog.danger ? 'btn-d solid' : 'btn-p'} autoFocus={!dialog.input}>{dialog.ok || 'Đồng ý'}</button>
        </div>
      </form>
    </Modal>
  );
}
