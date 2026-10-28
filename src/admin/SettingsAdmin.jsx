import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Field, ImageInput } from './ui.jsx';

const AFF_LABEL = { giaotrinh: 'Giáo trình HSK 1 (túi đồ nghề)', giaotrinh2: 'Giáo trình HSK 2', giaotrinh3: 'Giáo trình HSK 3', but: 'Bút viết', vo: 'Vở ô ly' };
const PR_LABEL = { p1: 'Prompt phân tích chữ Hán', p2: 'Prompt 2', p3: 'Prompt 3', p4: 'Prompt 4' };

export default function SettingsAdmin() {
  const { content, store, run, toast } = useApp();
  const [s, setS] = useState(() => structuredClone(content.settings));
  const [tab, setTab] = useState('bank');
  const set = (k, v) => setS({ ...s, [k]: v });
  const setIn = (k, sub, v) => setS({ ...s, [k]: { ...s[k], [sub]: v } });
  const setArr = (k, i, sub, v) => setS({ ...s, [k]: s[k].map((x, j) => (j === i ? { ...x, [sub]: v } : x)) });
  const save = () => run(() => store.saveSettings(s), 'Đã lưu cài đặt.');
  const err = (m) => toast(m, 'err');
  const TABS = [['bank', '💝 Ủng hộ'], ['aff', '🛒 Link mua'], ['tools', '🎒 Túi đồ nghề'], ['apps', '📱 App học'], ['pr', '🤖 Prompt AI']];

  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Cài đặt</h1><button type="button" className="btn-p" onClick={save}>Lưu thay đổi</button></div>
      <div className="seg">{TABS.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="card form">
        {tab === 'bank' && (<>
          <div className="grid3">
            <Field label="Ngân hàng"><input value={s.bank.name} onChange={(e) => setIn('bank', 'name', e.target.value)} /></Field>
            <Field label="Số tài khoản"><input value={s.bank.number} onChange={(e) => setIn('bank', 'number', e.target.value)} /></Field>
            <Field label="Chủ tài khoản"><input value={s.bank.owner} onChange={(e) => setIn('bank', 'owner', e.target.value)} /></Field>
          </div>
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
