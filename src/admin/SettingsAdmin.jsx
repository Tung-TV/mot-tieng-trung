import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Field, ImageInput } from './ui.jsx';
import { DEFAULT_PLAN, DEFAULT_SUPPORT, fmtVnd, messengerUrl, zaloUrl } from '../services/model.js';

const AFF_LABEL = { giaotrinh: 'Giáo trình HSK 1 (túi đồ nghề)', giaotrinh2: 'Giáo trình HSK 2', giaotrinh3: 'Giáo trình HSK 3', but: 'Bút viết', vo: 'Vở ô ly' };
const PR_LABEL = { p1: 'Prompt phân tích chữ Hán', p2: 'Prompt 2', p3: 'Prompt 3', p4: 'Prompt 4' };

export default function SettingsAdmin() {
  const { content, store, run, toast } = useApp();
  const [s, setS] = useState(() => { const x = structuredClone(content.settings); x.plan = { ...DEFAULT_PLAN, ...(x.plan || {}) }; x.support = { ...DEFAULT_SUPPORT, ...(x.support || {}) }; return x; });
  const [tab, setTab] = useState('plan');
  const set = (k, v) => setS({ ...s, [k]: v });
  const setIn = (k, sub, v) => setS({ ...s, [k]: { ...s[k], [sub]: v } });
  const setArr = (k, i, sub, v) => setS({ ...s, [k]: s[k].map((x, j) => (j === i ? { ...x, [sub]: v } : x)) });
  const save = () => run(() => store.saveSettings({ ...s, plan: { ...s.plan, benefits: (s.plan.benefits || []).map((x) => x.trim()).filter(Boolean) } }), 'Đã lưu cài đặt.');
  const err = (m) => toast(m, 'err');
  const TABS = [['plan', '⭐ Gói học viên'], ['bank', '💝 Ngân hàng'], ['support', '💬 Hỗ trợ'], ['aff', '🛒 Link mua'], ['tools', '🎒 Túi đồ nghề'], ['apps', '📱 App học'], ['pr', '🤖 Prompt AI']];

  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Cài đặt</h1><button type="button" className="btn-p" onClick={save}>Lưu thay đổi</button></div>
      <div className="seg">{TABS.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="card form">
        {tab === 'plan' && (<>
          <p className="muted">Thông tin hiển thị ở trang “Nâng cấp tài khoản”. Giá và thời hạn áp dụng cho các mã giao dịch tạo từ nay về sau.</p>
          <div className="grid3">
            <Field label="Tên gói"><input value={s.plan.name} onChange={(e) => setIn('plan', 'name', e.target.value)} /></Field>
            <Field label="Giá (đồng)" hint={fmtVnd(s.plan.price)}><input type="number" min="0" step="1000" value={s.plan.price} onChange={(e) => setIn('plan', 'price', Math.max(0, parseInt(e.target.value, 10) || 0))} /></Field>
            <Field label="Thời hạn (tháng)" hint="0 = không giới hạn thời gian"><input type="number" min="0" value={s.plan.months} onChange={(e) => setIn('plan', 'months', Math.max(0, parseInt(e.target.value, 10) || 0))} /></Field>
          </div>
          <Field label="Quyền lợi — mỗi dòng một ý"><textarea rows={5} value={(s.plan.benefits || []).join('\n')} onChange={(e) => setIn('plan', 'benefits', e.target.value.split('\n'))} /></Field>
        </>)}

        {tab === 'support' && (<>
          <p className="muted">Hiện thành nút “💬 Hỗ trợ” ở góc phải mọi trang, và trong trang Nâng cấp (kèm sẵn mã giao dịch). Để trống thì nút tự ẩn.</p>
          <div className="grid3">
            <Field label="Zalo" hint={s.support.zalo ? 'Mở: ' + zaloUrl(s.support.zalo) : 'Số điện thoại Zalo (VD 0912345678) hoặc link zalo.me/…'}><input value={s.support.zalo} onChange={(e) => setIn('support', 'zalo', e.target.value)} placeholder="0912345678" /></Field>
            <Field label="Trang Facebook" hint="Link trang/hồ sơ, VD https://facebook.com/mottiengtrung"><input value={s.support.facebook} onChange={(e) => setIn('support', 'facebook', e.target.value)} placeholder="https://facebook.com/…" /></Field>
            <Field label="Messenger (tuỳ chọn)" hint={messengerUrl(s.support) ? 'Mở: ' + messengerUrl(s.support) : 'Tên trang trong link m.me/… — để trống sẽ lấy từ link Facebook'}><input value={s.support.messenger} onChange={(e) => setIn('support', 'messenger', e.target.value)} placeholder="mottiengtrung" /></Field>
          </div>
          <div className="grid3">
            <Field label="Giờ hỗ trợ"><input value={s.support.hours} onChange={(e) => setIn('support', 'hours', e.target.value)} /></Field>
          </div>
          <label className="chk"><input type="checkbox" checked={s.support.floating !== false} onChange={(e) => setIn('support', 'floating', e.target.checked)} /> Hiện nút “💬 Hỗ trợ” nổi ở góc phải màn hình</label>
        </>)}

        {tab === 'bank' && (<>
          <p className="muted">Dùng cho hộp “Ủng hộ Mọt” và trang thanh toán nâng cấp.</p>
          <div className="grid3">
            <Field label="Ngân hàng"><input value={s.bank.name} onChange={(e) => setIn('bank', 'name', e.target.value)} /></Field>
            <Field label="Số tài khoản"><input value={s.bank.number} onChange={(e) => setIn('bank', 'number', e.target.value)} /></Field>
            <Field label="Chủ tài khoản"><input value={s.bank.owner} onChange={(e) => setIn('bank', 'owner', e.target.value)} /></Field>
          </div>
          <Field label="Mã ngân hàng cho VietQR" hint="VD: MB, VCB, TCB, ACB, BIDV… (hoặc mã BIN 6 số). Dùng để tạo mã QR có sẵn số tiền + mã giao dịch."><input value={s.bank.bankId || ''} onChange={(e) => setIn('bank', 'bankId', e.target.value.trim())} /></Field>
          <Field label="Ảnh mã QR"><ImageInput value={s.bank.qr} onChange={(v) => setIn('bank', 'qr', v)} onError={err} /></Field>
        </>)}

        {tab === 'aff' && (<>
          <p className="muted">Link tiếp thị (Shopee/TikTok…). Để trống thì nút “Mua” sẽ báo “sắp có link”.</p>
          {Object.keys(s.affiliate).map((k) => (
            <Field key={k} label={AFF_LABEL[k] || k}><input type="url" placeholder="https://…" value={s.affiliate[k]} onChange={(e) => setIn('affiliate', k, e.target.value)} /></Field>
          ))}
        </>)}

        {tab === 'tools' && s.tools.map((t, i) => (
          <fieldset key={t.k}><legend>{t.n} <small className="muted">(khoá link: {t.k})</small></legend>
            <div className="grid3">
              <Field label="Nhãn"><input value={t.n} onChange={(e) => setArr('tools', i, 'n', e.target.value)} /></Field>
              <Field label="Tiêu đề"><input value={t.t} onChange={(e) => setArr('tools', i, 't', e.target.value)} /></Field>
              <Field label="Màu"><input type="color" value={t.c} onChange={(e) => setArr('tools', i, 'c', e.target.value)} /></Field>
            </div>
            <Field label="Mô tả"><textarea rows={2} value={t.d} onChange={(e) => setArr('tools', i, 'd', e.target.value)} /></Field>
            <Field label="Ảnh"><ImageInput value={t.img} onChange={(v) => setArr('tools', i, 'img', v)} onError={err} /></Field>
          </fieldset>
        ))}

        {tab === 'apps' && (<>
          {s.apps.map((a, i) => (
            <fieldset key={i}><legend>{a.n}</legend>
              <div className="grid3">
                <Field label="Tên tab"><input value={a.n} onChange={(e) => setArr('apps', i, 'n', e.target.value)} /></Field>
                <Field label="Màu"><input type="color" value={a.c} onChange={(e) => setArr('apps', i, 'c', e.target.value)} /></Field>
                <div className="fld"><span>&nbsp;</span><button type="button" className="btn-d small" onClick={() => set('apps', s.apps.filter((_, j) => j !== i))}>Xoá app</button></div>
              </div>
              <Field label="Nội dung hướng dẫn (HTML)" hint='Thẻ script/iframe/onclick sẽ bị lọc bỏ khi hiển thị. Nút copy prompt: <button class="cp" data-copy="p1">Copy</button>'><textarea rows={8} className="mono" value={a.h} onChange={(e) => setArr('apps', i, 'h', e.target.value)} /></Field>
            </fieldset>
          ))}
          <button type="button" className="btn-s small" onClick={() => set('apps', [...s.apps, { n: 'App mới', c: '#3b82d6', h: '<p>Hướng dẫn…</p>' }])}>+ Thêm app</button>
        </>)}

        {tab === 'pr' && Object.keys(s.prompts).map((k) => (
          <Field key={k} label={(PR_LABEL[k] || k) + ' — mã ' + k}><textarea rows={5} value={s.prompts[k]} onChange={(e) => setIn('prompts', k, e.target.value)} /></Field>
        ))}
      </div>
      <div className="form-act"><button type="button" className="btn-p" onClick={save}>Lưu thay đổi</button></div>
    </>
  );
}
