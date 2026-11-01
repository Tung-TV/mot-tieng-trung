import { useState } from 'react';
// Thành phần dùng chung cho CMS
export const Field = ({ label, hint, children, wide }) => (
  <label className={'fld' + (wide ? ' wide' : '')}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
);

// "a | b" mỗi dòng  <->  [[a,b],...]
export const pairsToText = (arr = []) => arr.map((p) => p.join(' | ')).join('\n');
export const textToPairs = (t = '') => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
});

export function readImage(file, maxKB = 600) {
  return new Promise((res, rej) => {
    if (!file) return rej(new Error('Chưa chọn ảnh'));
    if (file.size > maxKB * 1024) return rej(new Error('Ảnh quá lớn (tối đa ' + maxKB + ' KB). Hãy nén ảnh hoặc dán đường dẫn ảnh.'));
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Không đọc được ảnh')); r.readAsDataURL(file);
  });
}

export function ImageInput({ value, onChange, onError }) {
  return (
    <div className="imgin">
      {value ? <img src={value} alt="" /> : <span className="ph-img">Chưa có ảnh</span>}
      <div>
        <input type="text" placeholder="Đường dẫn ảnh (https://… hoặc assets/…) hoặc tải lên" value={value && !value.startsWith('data:') ? value : ''} onChange={(e) => onChange(e.target.value)} />
        <div className="row-btns">
          <label className="btn-s small">Tải ảnh lên<input type="file" accept="image/*" hidden onChange={(e) => readImage(e.target.files[0]).then(onChange, (x) => onError && onError(x.message))} /></label>
          {value && <button type="button" className="btn-s small" onClick={() => onChange('')}>Xoá ảnh</button>}
        </div>
      </div>
    </div>
  );
}

export const Empty = ({ children }) => <p className="empty">{children}</p>;

/** Chọn tag kỹ năng cho chặng: bấm × để bỏ, (+) để thêm tag có sẵn hoặc tạo tag mới */
export function ChipPicker({ value = [], onChange, settings = {} }) {
  const [adding, setAdding] = useState(false);
  const [txt, setTxt] = useState('');
  const known = [...new Set([...Object.keys(settings.chipColors || {}), ...Object.keys(settings.chipEmojis || {})])];
  const rest = known.filter((k) => !value.includes(k));
  const add = (t) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setTxt(''); setAdding(false); };
  const chip = (k) => ({ background: (settings.chipColors || {})[k] || '#e6dfc7' });
  return (
    <div className="chip-pick">
      {value.map((k, i) => (
        <span key={k} className="chip" style={chip(k)}>
          {(settings.chipEmojis || {})[k] && <span className="cs">{settings.chipEmojis[k]}</span>}{k}
          {i > 0 && <button type="button" className="cp-mv" title="Đưa lên trước" onClick={() => { const a = [...value]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }}>‹</button>}
          <button type="button" className="cp-x" aria-label={'Bỏ tag ' + k} onClick={() => onChange(value.filter((x) => x !== k))}>×</button>
        </span>
      ))}
      {adding ? (
        <span className="cp-add">
          <input autoFocus list="chip-known" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Tên tag, VD: Luyện đề" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(txt); } if (e.key === 'Escape') setAdding(false); }} />
          <datalist id="chip-known">{rest.map((k) => <option key={k} value={k} />)}</datalist>
          <button type="button" className="btn-p small" onClick={() => add(txt)}>Thêm</button>
          <button type="button" className="btn-s small" onClick={() => setAdding(false)}>Huỷ</button>
        </span>
      ) : <button type="button" className="cp-plus" onClick={() => setAdding(true)} title="Thêm tag">＋ Thêm tag</button>}
      {!adding && rest.length > 0 && <span className="cp-sug">{rest.map((k) => <button key={k} type="button" className="chip cp-s" style={chip(k)} onClick={() => add(k)}>+ {k}</button>)}</span>}
    </div>
  );
}
