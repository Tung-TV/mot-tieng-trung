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
