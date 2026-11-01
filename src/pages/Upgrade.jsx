import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { Modal } from '../components/Overlays.jsx';
import { DEFAULT_PLAN, fmtVnd, vietQrPayload } from '../services/model.js';
import { qrSvg } from '../services/qr.js';
import { copyText } from '../services/util.js';

/** Hộp hiện ra khi tài khoản thường bấm vào phần dành cho học viên */
export function UpgradeModal() {
  const { upgradeOpen, setUpgradeOpen, content } = useApp();
  if (!upgradeOpen) return null;
  const plan = content.settings.plan || DEFAULT_PLAN;
  const close = () => setUpgradeOpen(false);
  return (
    <Modal title="Cần nâng cấp tài khoản" onClose={close}>
      <div className="up-modal">
        <div className="up-ic" aria-hidden="true">⭐</div>
        <p>Phần này dành cho <b>Học viên</b>. Nâng cấp tài khoản để mở toàn bộ lộ trình, bài học từng chặng và bài kiểm tra.</p>
        <ul className="up-list">{(plan.benefits || []).map((b, i) => <li key={i}>{b}</li>)}</ul>
        <div className="form-act">
          <button type="button" className="btn-s" onClick={close}>Để sau</button>
          <button type="button" className="btn-p" onClick={() => { close(); navigate('/nang-cap'); }}>Nâng cấp tài khoản · {fmtVnd(plan.price)}</button>
        </div>
      </div>
    </Modal>
  );
}

function CopyBtn({ text, label }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn-s small" onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 1500); } }}>{ok ? 'Đã sao chép' : label}</button>;
}

const STATUS = { pending: 'Chờ chuyển khoản', claimed: 'Đã báo chuyển khoản – chờ admin xác nhận', paid: 'Đã xác nhận', cancelled: 'Đã huỷ' };

/** Trang thanh toán: sinh mã giao dịch, hướng dẫn ghi mã vào nội dung chuyển khoản */
export default function Upgrade() {
  const { user, tier, content, store, toast, setAuthOpen, auth, ask } = useApp();
  const plan = content.settings.plan || DEFAULT_PLAN;
  const bank = content.settings.bank || {};
  const [req, setReq] = useState(undefined); // undefined = đang tải
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return setReq(null);
    try { setReq(await store.myUpgrade()); } catch (e) { toast(e.message, 'err'); setReq(null); }
  }, [user, store, toast]);
  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <section className="sk soon">
        <div className="soon-e">⭐</div>
        <h2>Nâng cấp tài khoản Học viên</h2>
        <p>Vui lòng đăng nhập (hoặc tạo tài khoản miễn phí) trước khi thanh toán, để Mọt kích hoạt đúng tài khoản cho bạn.</p>
        <div className="soon-a"><button className="btn-p" type="button" onClick={() => setAuthOpen('login')}>Đăng nhập</button><button className="btn-s" type="button" onClick={() => setAuthOpen('register')}>Tạo tài khoản</button></div>
      </section>
    );
  }
  if (tier === 'staff') {
    return <section className="sk soon"><div className="soon-e">🛠️</div><h2>Tài khoản quản trị</h2><p>Tài khoản quản trị/biên tập không cần nâng cấp.</p><div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/admin/nang-cap')}>Xem yêu cầu nâng cấp</button></div></section>;
  }
  if (tier === 'student') {
    return (
      <section className="sk soon">
        <div className="soon-e">🎉</div>
        <h2>Bạn đã là Học viên</h2>
        <p>{user.studentUntil ? 'Hạn học viên đến ngày ' + new Date(user.studentUntil).toLocaleDateString('vi-VN') + '.' : 'Tài khoản học viên không giới hạn thời gian.'}</p>
        <div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/lo-trinh')}>Vào lộ trình học</button></div>
      </section>
    );
  }

  const create = async () => {
    setBusy(true);
    try { setReq(await store.createUpgrade()); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const claim = async () => {
    try { await store.claimUpgrade(req.id); await load(); toast('Đã báo cho admin. Tài khoản sẽ được kích hoạt sau khi admin kiểm tra giao dịch.'); } catch (e) { toast(e.message, 'err'); }
  };
  const cancel = async () => {
    if (!(await ask({ title: 'Huỷ yêu cầu nâng cấp', message: 'Huỷ mã ' + req.code + '? Nếu bạn đã chuyển khoản với mã này, đừng huỷ — hãy chờ admin xác nhận.', danger: true, ok: 'Huỷ yêu cầu' }))) return;
    try { await store.cancelUpgrade(req.id); await load(); } catch (e) { toast(e.message, 'err'); }
  };
  const refresh = async () => { const u = await auth.refreshUser(); await load(); if (u && u.role === 'student') toast('Tài khoản đã được nâng cấp lên Học viên!'); };

  const active = req && (req.status === 'pending' || req.status === 'claimed');
  // mã QR VietQR tạo ngay trong trình duyệt: quét là app ngân hàng điền sẵn số tài khoản, số tiền và nội dung
  const payload = active ? vietQrPayload(bank, req.amount, req.code) : '';
  const qr = payload ? qrSvg(payload) : '';

  return (
    <div className="up-page">
      <section className="sk up-plan">
        <div>
          <span className="dn-badge">GÓI HỌC VIÊN</span>
          <h1>{plan.name}</h1>
          <div className="up-price">{fmtVnd(plan.price)}<small>{plan.months > 0 ? ' / ' + plan.months + ' tháng' : ' · dùng không giới hạn'}</small></div>
          <ul className="up-list">{(plan.benefits || []).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
        {!active && (
          <div className="up-start">
            {req && req.status === 'paid' && <p className="note-box">Yêu cầu {req.code} đã được xác nhận. Bấm “Kiểm tra lại” nếu tài khoản chưa đổi.</p>}
            <p>Bấm nút dưới để nhận <b>mã giao dịch</b> riêng của bạn, rồi chuyển khoản kèm mã đó.</p>
            <button className="btn-p" type="button" disabled={busy || req === undefined} onClick={create}>{busy ? 'Đang tạo…' : 'Tạo mã giao dịch'}</button>
            {req && req.status === 'paid' && <button className="btn-s" type="button" onClick={refresh}>Kiểm tra lại</button>}
          </div>
        )}
      </section>

      {active && (
        <section className="sk up-pay">
          <h2>Chuyển khoản để kích hoạt</h2>
          <div className="up-grid">
            <div className="up-qr">
              {qr ? <div className="up-qr-svg" role="img" aria-label={'Mã QR chuyển ' + fmtVnd(req.amount) + ' nội dung ' + req.code} dangerouslySetInnerHTML={{ __html: qr }} />
                : bank.qr ? <img src={bank.qr} alt="Mã QR tài khoản ngân hàng" /> : null}
              <small>{qr ? 'Mã QR đã có sẵn số tiền và nội dung' : 'Quét mã rồi tự nhập số tiền và nội dung'}</small>
            </div>
            <dl className="up-info">
              <dt>Mã giao dịch</dt><dd><b className="up-code">{req.code}</b> <CopyBtn text={req.code} label="Sao chép mã" /></dd>
              <dt>Số tiền</dt><dd><b>{fmtVnd(req.amount)}</b> <CopyBtn text={String(req.amount)} label="Sao chép" /></dd>
              <dt>Ngân hàng</dt><dd>{bank.name}</dd>
              <dt>Số tài khoản</dt><dd><b>{bank.number}</b> <CopyBtn text={bank.number} label="Sao chép" /></dd>
              <dt>Chủ tài khoản</dt><dd>{bank.owner}</dd>
              <dt>Trạng thái</dt><dd><span className={'pill-s ' + (req.status === 'claimed' ? 'on' : 'off')}>{STATUS[req.status]}</span></dd>
            </dl>
          </div>
          <div className="up-warn">
            <b>Quan trọng:</b> ghi đúng mã <b className="up-code">{req.code}</b> vào <b>nội dung / ghi chú chuyển khoản</b>. Admin dựa vào mã này để biết giao dịch là của tài khoản <b>{user.email}</b>.
          </div>
          <ol className="up-steps">
            <li>Mở app ngân hàng, quét mã QR (hoặc nhập số tài khoản ở trên).</li>
            <li>Nhập số tiền <b>{fmtVnd(req.amount)}</b> và nội dung <b>{req.code}</b>, rồi chuyển.</li>
            <li>Bấm “Tôi đã chuyển khoản”. Admin kiểm tra và kích hoạt tài khoản Học viên cho bạn (thường trong 24 giờ).</li>
          </ol>
          <div className="row-btns">
            {req.status === 'pending' && <button className="btn-p" type="button" onClick={claim}>Tôi đã chuyển khoản</button>}
            <button className="btn-s" type="button" onClick={refresh}>Kiểm tra trạng thái</button>
            <button className="btn-d" type="button" onClick={cancel}>Huỷ yêu cầu</button>
          </div>
        </section>
      )}
    </div>
  );
}
