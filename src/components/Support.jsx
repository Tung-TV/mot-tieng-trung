import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { facebookUrl, messengerUrl, supportOf, zaloUrl } from '../services/model.js';
import { copyText } from '../services/util.js';

const ZaloIcon = () => (
  <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#0068ff" /><text x="24" y="29.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="14" fill="#fff">Zalo</text></svg>
);
const MessengerIcon = () => (
  <svg viewBox="0 0 48 48" width="26" height="26" aria-hidden="true"><defs><linearGradient id="msg-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#0a7cff" /><stop offset=".6" stopColor="#a033ff" /><stop offset="1" stopColor="#ff5c87" /></linearGradient></defs>
    <path d="M24 4C12.7 4 4 12.3 4 23.5c0 5.9 2.4 11 6.4 14.5v6l5.8-3.2c2.4.7 5 1.1 7.8 1.1 11.3 0 20-8.3 20-19.5S35.3 4 24 4z" fill="url(#msg-g)" />
    <path d="M12 29.5l6.3-10 5 4 7-4.2-6.3 10-5-4z" fill="#fff" /></svg>
);

/** Có kênh hỗ trợ nào được cấu hình chưa */
export function useSupport(prefill = '') {
  const { content } = useApp();
  const s = supportOf(content && content.settings);
  const zalo = zaloUrl(s.zalo), msg = messengerUrl(s, prefill), fb = facebookUrl(s.facebook);
  return { s, zalo, msg, fb, any: !!(zalo || msg || fb) };
}

/** Nút chat nổi góc phải màn hình */
export function SupportFab() {
  const { s, zalo, msg, any } = useSupport();
  const [open, setOpen] = useState(false);
  if (!any || s.floating === false) return null;
  return (
    <div className={'sp-fab' + (open ? ' open' : '')}>
      {open && (
        <div className="sp-pop" role="dialog" aria-label="Liên hệ hỗ trợ">
          <b>Cần Mọt hỗ trợ?</b>
          <small>{s.hours}</small>
          {zalo && <a className="sp-btn zalo" href={zalo} target="_blank" rel="noopener noreferrer"><ZaloIcon />Chat Zalo</a>}
          {msg && <a className="sp-btn fb" href={msg} target="_blank" rel="noopener noreferrer"><MessengerIcon />Nhắn Facebook</a>}
        </div>
      )}
      <button type="button" className="sp-main" aria-expanded={open} aria-label={open ? 'Đóng hỗ trợ' : 'Mở hỗ trợ: Zalo, Facebook'} onClick={() => setOpen(!open)}>
        {open ? <span className="sp-x">×</span> : <><span className="sp-ic">💬</span><span className="sp-lb">Hỗ trợ</span></>}
      </button>
    </div>
  );
}

/** Khung hỗ trợ đặt trong trang (trang Nâng cấp…): kèm sẵn nội dung cần gửi, VD mã giao dịch */
export function SupportBox({ title = 'Cần hỗ trợ?', text, message }) {
  const { s, zalo, msg, fb, any } = useSupport(message);
  const [copied, setCopied] = useState(false);
  if (!any) return null;
  return (
    <div className="sp-box">
      <div><b>{title}</b><span>{text || 'Nhắn Mọt qua Zalo hoặc Facebook, Mọt trả lời trong giờ ' + s.hours + '.'}</span></div>
      <div className="row-btns">
        {zalo && <a className="sp-btn zalo" href={zalo} target="_blank" rel="noopener noreferrer"><ZaloIcon />Chat Zalo{s.zalo && !/^https?:/i.test(s.zalo) ? ' · ' + s.zalo : ''}</a>}
        {msg && <a className="sp-btn fb" href={msg} target="_blank" rel="noopener noreferrer"><MessengerIcon />Nhắn Facebook</a>}
        {!msg && fb && <a className="sp-btn fb" href={fb} target="_blank" rel="noopener noreferrer"><MessengerIcon />Trang Facebook</a>}
        {message && <button type="button" className="btn-s small" onClick={async () => { if (await copyText(message)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>{copied ? 'Đã sao chép' : 'Sao chép nội dung cần gửi'}</button>}
      </div>
      {message && <small className="muted">Nội dung gửi kèm: “{message}”{zalo ? ' (Zalo không tự điền sẵn, bạn dán vào khung chat nhé)' : ''}</small>}
    </div>
  );
}
