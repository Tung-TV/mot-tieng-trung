// Quà “Nhận ngay lộ trình”: khảo sát nhanh → làm nhiệm vụ (bấm là mở link, mở rồi mới tính xong) → nhận file.
// Mọi bước đều lưu lên máy chủ để admin thống kê (CMS › Thống kê học tập).
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { GIFT_GOALS, GIFT_LEVELS, GIFT_SOURCES, GIFT_TIMES, giftOf } from '../services/model.js';
import { Modal } from './Overlays.jsx';
import { copyText } from '../services/util.js';

const KEY = 'mot.gift.v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

/** Trạng thái nhiệm vụ dùng chung cho hộp “Nhận lộ trình” và trang Cộng đồng (lưu máy + máy chủ để thống kê) */
export function useGiftState() {
  const { content, store, user, toast } = useApp();
  const gift = giftOf(content.settings);
  const [st, setSt] = useState(() => load() || { id: uuid(), data: { n: user ? user.name : '', c: user ? user.email : '', l: GIFT_LEVELS[0], g: [], t: GIFT_TIMES[0], s: GIFT_SOURCES[0], tasks: {}, done: false } });
  const d = st.data;
  const doneN = gift.active.filter((t) => d.tasks[t.k]).length, all = gift.active.length;
  const persist = (data) => {
    const next = { ...st, data };
    setSt(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* */ }
    store.saveLead(next.id, data).catch(() => { /* không chặn người dùng nếu mạng lỗi */ });
  };
  // bấm nhiệm vụ = mở link ngay (thẻ <a> mở tab mới), đồng thời ghi nhận đã làm
  const mark = (k) => { if (!d.tasks[k]) persist({ ...d, tasks: { ...d.tasks, [k]: Date.now() } }); };
  // chia sẻ = sao chép link (link admin đặt cho nhiệm vụ, để trống thì link trang web) rồi báo đã sao chép
  const share = async () => {
    const t = gift.tasks.find((x) => x.k === 'share');
    const url = (t && t.url) || location.href.split('#')[0];
    if (await copyText(url)) toast('Đã sao chép link: ' + url + ' — gửi cho bạn bè nhé!');
    else toast('Link trang: ' + url, 'err');
    mark('share');
  };
  return { gift, d, doneN, all, persist, mark, share };
}

export default function RoadmapGift({ onClose }) {
  const { gift, d, doneN, all, persist, mark, share } = useGiftState();
  const [step, setStep] = useState(() => (!d.n || !d.c ? 1 : doneN >= all ? 3 : 2));
  const [err, setErr] = useState('');

  useEffect(() => { if (step === 3 && !d.done && doneN >= all) persist({ ...d, done: true, doneAt: Date.now() }); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = { ...d, n: String(f.get('n') || '').trim().slice(0, 60), c: String(f.get('c') || '').trim().slice(0, 80), l: f.get('l'), g: f.getAll('g'), t: f.get('t'), s: f.get('s'), at: d.at || Date.now() };
    if (!data.n || !data.c) { setErr('Bạn điền tên và Zalo / Email giúp Mọt nhé.'); return; }
    setErr(''); persist(data); setStep(2);
  };
  return (
    <Modal title="🎁 Nhận lộ trình học tiếng Trung" onClose={onClose}>
      <div className="gift">
        <div className="gift-stp">{[1, 2, 3].map((i) => <i key={i} className={step >= i ? 'on' : ''} />)}</div>
        {step === 1 && (
          <form className="form" onSubmit={submit} autoComplete="off">
            <p className="muted">📝 Khảo sát nhanh để Mọt gửi đúng lộ trình cho bạn (khoảng 1 phút).</p>
            <label className="fld"><span>Tên của bạn *</span><input name="n" defaultValue={d.n} maxLength={60} /></label>
            <label className="fld"><span>Zalo / Email *</span><input name="c" defaultValue={d.c} maxLength={80} placeholder="Để Mọt liên hệ khi có tài liệu mới" /></label>
            <label className="fld"><span>Trình độ hiện tại</span><select name="l" defaultValue={d.l}>{GIFT_LEVELS.map((x) => <option key={x}>{x}</option>)}</select></label>
            <fieldset><legend>Mục tiêu học (chọn nhiều)</legend><div className="gift-ck">{GIFT_GOALS.map((x) => <label key={x} className="chk"><input type="checkbox" name="g" value={x} defaultChecked={(d.g || []).includes(x)} /> {x}</label>)}</div></fieldset>
            <label className="fld"><span>Thời gian học mỗi ngày</span><select name="t" defaultValue={d.t}>{GIFT_TIMES.map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="fld"><span>Bạn biết Mọt qua đâu?</span><select name="s" defaultValue={d.s}>{GIFT_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></label>
            {err && <p className="err">{err}</p>}
            <div className="form-act"><button type="button" className="btn-s" onClick={onClose}>Để sau</button><button className="btn-p">Tiếp: làm nhiệm vụ ›</button></div>
          </form>
        )}
        {step === 2 && (
          <div className="gift-tasks">
            <p className="muted">🎯 Bấm vào từng nhiệm vụ để mở kênh của Mọt, theo dõi / tham gia rồi quay lại đây. Mở xong là nhiệm vụ được tính hoàn thành.</p>
            <div className="gift-pg"><div className="bar"><i style={{ width: (all ? Math.round((doneN / all) * 100) : 100) + '%' }} /></div><span>{doneN}/{all}</span></div>
            {gift.active.map((t) => {
              const ok = !!d.tasks[t.k];
              return t.k === 'share'
                ? <button key={t.k} type="button" className={'gift-t' + (ok ? ' on' : '')} onClick={share}><span>{ok ? '✓' : '📤'}</span><b>{t.label}</b><em>{ok ? 'Đã xong' : 'Chia sẻ ›'}</em></button>
                : <a key={t.k} className={'gift-t' + (ok ? ' on' : '')} href={t.url} target="_blank" rel="noopener noreferrer" onClick={() => mark(t.k)}><span>{ok ? '✓' : '↗'}</span><b>{t.label}</b><em>{ok ? 'Đã xong' : 'Mở ›'}</em></a>;
            })}
            {!all && <p className="muted">Mọt đang cập nhật nhiệm vụ, bạn nhận lộ trình luôn nhé.</p>}
            <div className="form-act"><button type="button" className="btn-s" onClick={() => setStep(1)}>‹ Sửa khảo sát</button><button type="button" className="btn-p" disabled={doneN < all} onClick={() => setStep(3)}>{doneN < all ? 'Còn ' + (all - doneN) + ' nhiệm vụ' : '🎁 Nhận lộ trình'}</button></div>
          </div>
        )}
        {step === 3 && (
          <div className="gift-win">
            <span className="em">🎉</span>
            <h3>Chúc mừng {d.n || 'bạn'}!</h3>
            <p>Bạn đã hoàn thành mọi nhiệm vụ. Đây là file <b>Lộ trình học tiếng Trung cho người mới</b> của bạn:</p>
            {gift.file ? <a className="btn-p" href={gift.file} target="_blank" rel="noopener noreferrer" onClick={() => persist({ ...d, done: true, fileAt: d.fileAt || Date.now() })}>⬇ Tải file lộ trình</a>
              : <p className="note-box">File lộ trình sẽ xuất hiện tại đây ngay khi Mọt cập nhật link. Bạn quay lại sau nhé!</p>}
            <div className="form-act"><button type="button" className="btn-s" onClick={() => setStep(2)}>‹ Xem lại nhiệm vụ</button><button type="button" className="btn-p" onClick={onClose}>Đóng</button></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
