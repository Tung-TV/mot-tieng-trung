import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Overlays.jsx';
import { DocArt } from '../components/DocCard.jsx';
import { FM } from '../components/docArt.js';
import { ARTKIND } from '../services/seed.js';
import { fmtN, nrm } from '../services/util.js';
import { Field, Empty } from './ui.jsx';

const KIND_LABEL = { book: 'Sách', slide: 'Slide', kids: 'Slide trẻ em', sheet: 'Bảng tính', radical: 'Bộ thủ', grid: 'Ô luyện viết', exam: 'Đề thi', doc: 'Văn bản Word', letter: 'Lá thư' };
const BLANK = { name: '', format: 'PDF', url: '', downloads: 0, published: true, art: { kind: 'book', l1: 'HSK 1', l2: 'GIÁO TRÌNH', ch: '学', color: '#3b82d6' } };

function DocForm({ initial, onSave, onClose }) {
  const [d, setD] = useState(structuredClone(initial));
  const [err, setErr] = useState('');
  const set = (k, v) => setD({ ...d, [k]: v });
  const setArt = (k, v) => setD({ ...d, art: { ...d.art, [k]: v } });
  const submit = (e) => {
    e.preventDefault();
    if (!d.name.trim()) return setErr('Nhập tên tài liệu.');
    if (!/^https?:\/\//i.test(d.url.trim())) return setErr('Đường dẫn phải bắt đầu bằng http:// hoặc https://');
    onSave({ ...d, name: d.name.trim(), url: d.url.trim(), downloads: Math.max(0, parseInt(d.downloads, 10) || 0) });
  };
  return (
    <Modal title={initial.id ? 'Sửa tài liệu' : 'Thêm tài liệu'} onClose={onClose} wide>
      <form className="form grid2" onSubmit={submit}>
        <div>
          <Field label="Tên tài liệu"><input value={d.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Định dạng">
            <select value={d.format} onChange={(e) => set('format', e.target.value)}>{Object.keys(FM).map((f) => <option key={f}>{f}</option>)}</select>
          </Field>
          <Field label="Đường dẫn tải (Google Drive…)" hint="Nhớ bật chia sẻ “Bất kỳ ai có đường liên kết”."><input type="url" value={d.url} onChange={(e) => set('url', e.target.value)} required /></Field>
          <Field label="Lượt tải"><input type="number" min="0" value={d.downloads} onChange={(e) => set('downloads', e.target.value)} /></Field>
          <label className="chk"><input type="checkbox" checked={d.published !== false} onChange={(e) => set('published', e.target.checked)} /> Hiển thị trên Kho tài liệu</label>
        </div>
        <div>
          <div className="art-prev" style={{ '--fc': d.art.color }}><div className="cd-img"><DocArt doc={d} idx="preview" /></div></div>
          <Field label="Kiểu ảnh minh hoạ">
            <select value={d.art.kind} onChange={(e) => setArt('kind', e.target.value)}>{ARTKIND.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
          </Field>
          <div className="grid2 tight">
            <Field label="Dòng chữ 1"><input value={d.art.l1} onChange={(e) => setArt('l1', e.target.value)} maxLength={20} /></Field>
            <Field label="Dòng chữ 2"><input value={d.art.l2} onChange={(e) => setArt('l2', e.target.value)} maxLength={24} /></Field>
            <Field label="Chữ Hán / emoji"><input value={d.art.ch} onChange={(e) => setArt('ch', e.target.value)} maxLength={4} /></Field>
            <Field label="Màu chủ đạo"><input type="color" value={d.art.color} onChange={(e) => setArt('color', e.target.value)} /></Field>
          </div>
        </div>
        {err && <p className="err wide">{err}</p>}
        <div className="form-act wide"><button type="button" className="btn-s" onClick={onClose}>Huỷ</button><button className="btn-p">Lưu tài liệu</button></div>
      </form>
    </Modal>
  );
}

export default function DocsAdmin() {
  const { content, store, run, ask } = useApp();
  const [q, setQ] = useState('');
  const [fmt, setFmt] = useState('ALL');
  const [edit, setEdit] = useState(null);
  const list = useMemo(() => content.documents.filter((d) => (fmt === 'ALL' || d.format === fmt) && (!q || nrm(d.name).includes(nrm(q)))), [content, q, fmt]);

  const save = async (d) => { await run(() => store.saveDocument(d), 'Đã lưu tài liệu.'); setEdit(null); };
  const del = async (d) => (await ask({ title: 'Xoá tài liệu', message: 'Xoá “' + d.name + '”? Không thể hoàn tác.', danger: true, ok: 'Xoá' })) && run(() => store.deleteDocument(d.id), 'Đã xoá tài liệu.');
  const toggle = (d) => run(() => store.saveDocument({ ...d, published: d.published === false }), d.published === false ? 'Đã hiện tài liệu.' : 'Đã ẩn tài liệu.');

  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Tài liệu <small>{content.documents.length}</small></h1><button className="btn-p" type="button" onClick={() => setEdit(BLANK)}>+ Thêm tài liệu</button></div>
      <div className="adm-filter">
        <input type="search" placeholder="Tìm theo tên…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="ALL">Mọi định dạng</option>{Object.keys(FM).map((f) => <option key={f}>{f}</option>)}</select>
      </div>
      <div className="tbl-wrap">
        <table className="tbl-adm">
          <thead><tr><th>Ảnh</th><th>Tên</th><th>Định dạng</th><th>Lượt tải</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td className="mini-art" style={{ '--fc': d.art?.color }}><DocArt doc={d} idx={'m' + d.id} /></td>
                <td><b>{d.name}</b><a className="url" href={d.url} target="_blank" rel="noopener noreferrer">{d.url}</a></td>
                <td><span className="fmt" style={{ background: (FM[d.format] || FM.PDF).c }}>{d.format}</span></td>
                <td>{fmtN(d.downloads)}</td>
                <td><button type="button" className={'pill-s ' + (d.published === false ? 'off' : 'on')} onClick={() => toggle(d)}>{d.published === false ? 'Đang ẩn' : 'Hiển thị'}</button></td>
                <td className="acts"><button type="button" className="btn-s small" onClick={() => setEdit(d)}>Sửa</button><button type="button" className="btn-d small" onClick={() => del(d)}>Xoá</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <Empty>Không có tài liệu phù hợp.</Empty>}
      </div>
      {edit && <DocForm initial={edit} onSave={save} onClose={() => setEdit(null)} />}
    </>
  );
}
