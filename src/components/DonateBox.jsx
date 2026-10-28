import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { copyText } from '../services/util.js';
import { QrModal } from './Overlays.jsx';


export default function DonateBox({ zoom, setZoom }) {
  const { content } = useApp();
  const bank = content.settings.bank;
  const [copied, setCopied] = useState(false);
  const copy = async () => { await copyText(bank.number); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <aside className="panel donate" aria-labelledby="dt">
      <div className="dn-top"><span className="dn-badge">ỦNG HỘ ADMIN</span><div className="dn-heart" aria-hidden="true">💖</div><h2 id="dt">Cùng Mọt chia sẻ thêm thật nhiều tài liệu</h2></div>
      <div className="dn-body">
        <p>Kho tài liệu này do admin tự tay sưu tầm và chia sẻ miễn phí. Mỗi đóng góp của bạn là động lực để Mọt cố gắng hơn nữa.</p>
        <ul className="dn-list"><li>📚 Sưu tầm thêm giáo trình, đề thi mới</li><li>🔄 Cập nhật tài liệu thường xuyên</li><li>🌱 Giữ kho tài liệu luôn miễn phí</li></ul>
        <div className="qr-frame">
          <div className="qr" role="button" tabIndex={0} title="Bấm để phóng to mã QR" style={{ borderStyle: 'solid' }}
            onClick={() => bank.qr && setZoom(true)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), bank.qr && setZoom(true))}>
            {bank.qr ? <img src={bank.qr} alt="Mã QR chuyển khoản" /> : <span>Mã QR chuyển khoản</span>}
          </div>
        </div>
        <div className="bank">Ngân hàng: <b>{bank.name}</b><br />Số tài khoản: <b>{bank.number}</b><br />Chủ tài khoản: <b>{bank.owner}</b></div>
        <button className="copy" type="button" onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép số tài khoản'}</button>
        <div className="note">Cảm ơn bạn rất nhiều. Dù ít hay nhiều, admin đều trân trọng. 🙏</div>
      </div>
      {zoom && <QrModal src={bank.qr} onClose={() => setZoom(false)} />}
    </aside>
  );
}
