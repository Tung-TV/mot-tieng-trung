import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Overlays.jsx';
import { ChipPicker, Field, ImageInput, pairsToText, textToPairs } from './ui.jsx';
import { allQuestions, normTest } from '../services/model.js';
import TestEditor, { cleanTest } from './TestEditor.jsx';

const BLANK = { key: 'Bậc mới', emoji: '📘', color: '#74b5e4', whiteText: false, title: 'HSK', badge: 'Sơ cấp', desc: '', chips: ['Bài giảng', 'Từ vựng'], keyword: 'HSK', sections: [], info: [], lessons: [], ribbon: '', ribbonColor: '#c4001d', affKey: '', cover: '', boxes: [], test: null, completion: 'test' };

function StageForm({ initial, onSave, onClose, affKeys, toast }) {
  const { content } = useApp();
  const [s, setS] = useState(() => ({ ...structuredClone(initial), test: normTest(initial.test), completion: initial.completion || 'test' }));
  const [txt, setTxt] = useState({
    chips: [...(initial.chips || [])],
    lessons: pairsToText(initial.lessons),
    info: pairsToText(initial.info),
  });
  const set = (k, v) => setS({ ...s, [k]: v });
  const setSec = (i, k, v) => set('sections', s.sections.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = (e) => {
    e.preventDefault();
    const mode = s.completion === 'button' ? 'button' : 'test';
    const { test, error } = mode === 'button' ? { test: cleanTest(s.test).test || null } : cleanTest(s.test);
    if (error) return toast('Bài kiểm tra: ' + error, 'err');
    onSave({ ...s, completion: mode, test, chips: txt.chips, lessons: textToPairs(txt.lessons), info: textToPairs(txt.info) });
  };
  return (
    <Modal title={initial.id ? 'Sửa chặng: ' + initial.key : 'Thêm chặng'} onClose={onClose} wide>
      <form className="form" onSubmit={submit}>
        <div className="grid3">
          <Field label="Tên bậc (hiển thị ở bậc thang)"><input value={s.key} onChange={(e) => set('key', e.target.value)} required /></Field>
          <Field label="Emoji"><input value={s.emoji} onChange={(e) => set('emoji', e.target.value)} maxLength={4} /></Field>
          <Field label="Màu"><input type="color" value={s.color} onChange={(e) => set('color', e.target.value)} /></Field>
          <Field label="Tiêu đề"><input value={s.title} onChange={(e) => set('title', e.target.value)} required /></Field>
          <Field label="Nhãn cấp độ" hint="Nhãn kết thúc bằng “cấp” sẽ không hiện trên thẻ (giống bản gốc)."><input value={s.badge} onChange={(e) => set('badge', e.target.value)} /></Field>
          <Field label="Từ khoá lọc Kho tài liệu" hint="Bấm “Vào học” sẽ mở Kho với từ khoá này."><input value={s.keyword} onChange={(e) => set('keyword', e.target.value)} /></Field>
        </div>
        <label className="chk"><input type="checkbox" checked={!!s.whiteText} onChange={(e) => set('whiteText', e.target.checked)} /> Chữ trắng trên nền màu</label>
        <Field label="Mô tả"><textarea rows={2} value={s.desc} onChange={(e) => set('desc', e.target.value)} /></Field>
        <div className="fld"><span>Tag kỹ năng (màu và biểu tượng sửa ở Cài đặt › 🏷️ Tag)</span><ChipPicker value={txt.chips} onChange={(v) => setTxt({ ...txt, chips: v })} settings={content.settings} /></div>

        <fieldset><legend>Thông tin giáo trình (tuỳ chọn)</legend>
          <div className="grid3">
            <Field label="Dòng ruy-băng"><input value={s.ribbon} onChange={(e) => set('ribbon', e.target.value)} /></Field>
            <Field label="Màu ruy-băng"><input type="color" value={s.ribbonColor || '#c4001d'} onChange={(e) => set('ribbonColor', e.target.value)} /></Field>
            <Field label="Link mua sách (khoá affiliate)">
              <select value={s.affKey} onChange={(e) => set('affKey', e.target.value)}><option value="">— không —</option>{affKeys.map((k) => <option key={k}>{k}</option>)}</select>
            </Field>
          </div>
          <Field label="Bảng thông tin — mỗi dòng “Nhãn | Nội dung”" hint="Dòng có nhãn “Giáo trình” sẽ hiện ảnh bìa và nút mua."><textarea rows={3} value={txt.info} onChange={(e) => setTxt({ ...txt, info: e.target.value })} /></Field>
          <Field label="Ảnh bìa giáo trình"><ImageInput value={s.cover} onChange={(v) => set('cover', v)} onError={(m) => toast(m, 'err')} /></Field>
          <Field label="Danh sách bài học — mỗi dòng “中文 | Tiếng Việt”"><textarea rows={6} value={txt.lessons} onChange={(e) => setTxt({ ...txt, lessons: e.target.value })} /></Field>
        </fieldset>

        <fieldset><legend>Nhóm buổi học (tuỳ chọn)</legend>
          {s.sections.map((x, i) => (
            <div key={i} className="sec-edit">
              <div className="grid3">
                <Field label="Tên nhóm"><input value={x.title} onChange={(e) => setSec(i, 'title', e.target.value)} /></Field>
                <Field label="Màu"><input type="color" value={x.color} onChange={(e) => setSec(i, 'color', e.target.value)} /></Field>
                <Field label="Ghi chú"><input value={x.note} onChange={(e) => setSec(i, 'note', e.target.value)} /></Field>
              </div>
              <Field label="Các buổi — mỗi dòng “Buổi 1 | Nội dung”"><textarea rows={3} defaultValue={pairsToText(x.items)} onBlur={(e) => setSec(i, 'items', textToPairs(e.target.value))} /></Field>
              <button type="button" className="btn-d small" onClick={() => set('sections', s.sections.filter((_, j) => j !== i))}>Xoá nhóm</button>
            </div>
          ))}
          <button type="button" className="btn-s small" onClick={() => set('sections', [...s.sections, { title: 'Nhóm mới', color: '#7bb8e8', items: [], note: '' }])}>+ Thêm nhóm buổi học</button>
        </fieldset>
        <fieldset><legend>Ai được vào học</legend>
          <div className="row-btns">
            <label className={'q-opt' + (!s.free ? ' on' : '')}><input type="radio" name="free" checked={!s.free} onChange={() => set('free', false)} /> ⭐ Chỉ Học viên (Khoá học)</label>
            <label className={'q-opt' + (s.free ? ' on' : '')}><input type="radio" name="free" checked={!!s.free} onChange={() => set('free', true)} /> 🎁 Miễn phí (mọi người)</label>
          </div>
          <small className="muted">Danh sách lộ trình luôn xem miễn phí. Đây là quyền vào trang chặng và làm bài kiểm tra. Bài học miễn phí (học thử) đặt trong mục <a href="#/admin/bai-hoc">Bài học</a>.</small>
        </fieldset>
        <fieldset><legend>Hoàn thành chặng</legend>
          <div className="row-btns">
            <label className={'q-opt' + (s.completion !== 'button' ? ' on' : '')}><input type="radio" name="completion" checked={s.completion !== 'button'} onChange={() => set('completion', 'test')} /> Phải đạt bài kiểm tra</label>
            <label className={'q-opt' + (s.completion === 'button' ? ' on' : '')}><input type="radio" name="completion" checked={s.completion === 'button'} onChange={() => set('completion', 'button')} /> Bấm nút “Hoàn thành chặng” (không cần kiểm tra)</label>
          </div>
          {s.completion !== 'button' && <TestEditor test={s.test} lessons={textToPairs(txt.lessons)} onChange={(t) => set('test', t)} />}
          {s.completion !== 'button' && !s.test && <p className="err">Chặng này chưa có bài kiểm tra: học viên sẽ dừng ở đây cho tới khi có bài.</p>}
        </fieldset>
        {(s.boxes || []).length > 0 && <p className="muted">Chặng này có hộp “Dụng cụ / App học” — nội dung các hộp sửa ở <a href="#/admin/cai-dat">Cài đặt</a>.</p>}
        <div className="form-act"><button type="button" className="btn-s" onClick={onClose}>Huỷ</button><button className="btn-p">Lưu chặng</button></div>
      </form>
    </Modal>
  );
}

export default function StagesAdmin() {
  const { content, store, run, toast, ask } = useApp();
  const [edit, setEdit] = useState(null);
  const stages = content.stages;
  const move = (i, d) => {
    const ids = stages.map((s) => s.id); const j = i + d; if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]]; run(() => store.reorderStages(ids));
  };
  const save = async (s) => { await run(() => store.saveStage(s), 'Đã lưu chặng.'); setEdit(null); };
  const del = async (s) => (await ask({ title: 'Xoá chặng', message: 'Xoá chặng “' + s.key + ' · ' + s.title + '”? Tiến độ “đã xong” của học viên ở chặng này cũng mất.', danger: true, ok: 'Xoá' })) && run(() => store.deleteStage(s.id), 'Đã xoá chặng.');
  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Lộ trình học <small>{stages.length} chặng</small></h1><button className="btn-p" type="button" onClick={() => setEdit(BLANK)}>+ Thêm chặng</button></div>
      <ol className="stage-list">
        {stages.map((s, i) => (
          <li key={s.id}>
            <span className="sw" style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }}>{s.emoji}</span>
            <div><b>Bậc {i + 1} · {s.key}</b><span>{s.title} · {(s.chips || []).length} kỹ năng · {(s.lessons || []).length} bài học · {s.completion === 'button' ? 'hoàn thành bằng nút' : allQuestions(normTest(s.test)).length ? 'kiểm tra ' + allQuestions(normTest(s.test)).length + ' câu, đạt ' + normTest(s.test).pass + '%' : '⚠ chưa có bài kiểm tra'}{s.keyword ? ' · từ khoá “' + s.keyword + '”' : ''}</span></div>
            <div className="acts">
              <button type="button" className="btn-s small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên">↑</button>
              <button type="button" className="btn-s small" onClick={() => move(i, 1)} disabled={i === stages.length - 1} aria-label="Xuống">↓</button>
              <button type="button" className="btn-s small" onClick={() => setEdit(s)}>Sửa</button>
              <button type="button" className="btn-d small" onClick={() => del(s)}>Xoá</button>
            </div>
          </li>
        ))}
      </ol>
      {edit && <StageForm initial={edit} affKeys={Object.keys(content.settings.affiliate)} toast={toast} onSave={save} onClose={() => setEdit(null)} />}
    </>
  );
}
