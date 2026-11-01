// CMS › Bài học (Khoá học): video, từ vựng, chữ luyện viết, ngữ pháp + bài tập, câu luyện nói của từng bài
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Overlays.jsx';
import { stageLevel } from '../services/model.js';
import { ytId } from '../pages/Lesson.jsx';
import { Empty, Field } from './ui.jsx';

// “a | b | c” mỗi dòng  <->  [[a,b,c]]
const rowsToText = (rows = []) => rows.map((r) => r.join(' | ')).join('\n');
const textToRows = (t = '', n = 3) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const a = l.split('|').map((x) => x.trim()); while (a.length < n) a.push(''); return a.slice(0, n); });
// Từ vựng: “汉字 | pinyin | loại từ | nghĩa”, ví dụ ở dòng sau bắt đầu bằng “-”: “- 中文 | pinyin | nghĩa”
const vocabToText = (v = []) => v.map((w) => [w.h, w.p, w.t, w.m].join(' | ') + (w.e || []).map((e) => '\n- ' + e.join(' | ')).join('')).join('\n');
function textToVocab(t = '') {
  const out = [];
  t.split('\n').forEach((l0) => {
    const l = l0.trim(); if (!l) return;
    if (l.startsWith('-')) { if (out.length) out[out.length - 1].e.push(textToRows(l.slice(1), 3)[0]); return; }
    const [h, p, ty, m] = textToRows(l, 4)[0];
    out.push({ h, p, t: ty, m, e: [] });
  });
  return out;
}
const blank = (lv, n) => ({ id: lv + '-' + n, level: lv, n, title: '', vi: '', free: false, videos: [], vocab: [], write: '', grammar: [], quiz: [], speak: [] });
const TAB = [['chung', 'Chung & video'], ['vocab', 'Từ vựng'], ['write', 'Luyện viết'], ['grammar', 'Ngữ pháp'], ['quiz', 'Bài tập'], ['speak', 'Luyện nói']];

function GrammarEdit({ g, onChange, onDel, i }) {
  const set = (k, v) => onChange({ ...g, [k]: v });
  return (
    <div className="sec-edit">
      <div className="grid2">
        <Field label={'Điểm ngữ pháp ' + (i + 1)}><input value={g.t} onChange={(e) => set('t', e.target.value)} placeholder="VD: Câu 是……的" /></Field>
        <Field label="Biểu tượng"><input value={g.e || ''} onChange={(e) => set('e', e.target.value)} placeholder="🙂" /></Field>
      </div>
      <Field label="Công thức"><input value={g.rule || ''} onChange={(e) => set('rule', e.target.value)} placeholder="主语 + 是 + … + 的" /></Field>
      <Field label="Giải thích"><textarea rows={2} value={g.note || ''} onChange={(e) => set('note', e.target.value)} /></Field>
      <Field label="Ví dụ — mỗi dòng “中文 | pinyin | nghĩa”"><textarea rows={3} defaultValue={rowsToText(g.ex)} onBlur={(e) => set('ex', textToRows(e.target.value))} /></Field>
      <Field label="Mẹo"><input value={g.tip || ''} onChange={(e) => set('tip', e.target.value)} /></Field>
      <button type="button" className="btn-d small" onClick={onDel}>Xoá điểm ngữ pháp</button>
    </div>
  );
}

function QuizEdit({ q, onChange, onDel, i }) {
  const set = (k, v) => onChange({ ...q, [k]: v });
  return (
    <div className="sec-edit">
      <div className="grid2">
        <Field label={'Câu ' + (i + 1)}><select value={q.type} onChange={(e) => onChange(e.target.value === 'order' ? { type: 'order', q: q.q, w: [], h: '' } : { type: 'choice', q: q.q, o: ['', ''], a: 0, why: '' })}><option value="choice">Trắc nghiệm</option><option value="order">Sắp xếp câu</option></select></Field>
        <Field label="Đề bài"><input value={q.q} onChange={(e) => set('q', e.target.value)} /></Field>
      </div>
      {q.type === 'order' ? (
        <div className="grid2">
          <Field label="Câu đúng, các phần cách nhau bằng dấu cách" hint="VD: 我 是 越南人 。"><input defaultValue={(q.w || []).join(' ')} onBlur={(e) => set('w', e.target.value.split(/\s+/).filter(Boolean))} /></Field>
          <Field label="Pinyin (tuỳ chọn)"><input value={q.h || ''} onChange={(e) => set('h', e.target.value)} /></Field>
        </div>
      ) : (
        <>
          <Field label="Các lựa chọn — mỗi dòng một đáp án, thêm * ở đầu đáp án đúng"><textarea rows={3} defaultValue={(q.o || []).map((o, j) => (j === q.a ? '*' : '') + o).join('\n')} onBlur={(e) => { const ls = e.target.value.split('\n').map((x) => x.trim()).filter(Boolean); const a = Math.max(0, ls.findIndex((x) => x.startsWith('*'))); onChange({ ...q, o: ls.map((x) => x.replace(/^\*/, '').trim()), a }); }} /></Field>
          <Field label="Giải thích khi trả lời"><input value={q.why || ''} onChange={(e) => set('why', e.target.value)} /></Field>
        </>
      )}
      <button type="button" className="btn-d small" onClick={onDel}>Xoá câu</button>
    </div>
  );
}

function LessonEditor({ initial, onSave, onClose }) {
  const [l, setL] = useState(() => structuredClone(initial));
  const [tab, setTab] = useState('chung');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await onSave(l); } finally { setBusy(false); } };
  return (
    <Modal title={'Bài ' + l.n + ' · HSK' + l.level + (l.title ? ' · ' + l.title : '')} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <div className="seg">{TAB.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>)}</div>
        {tab === 'chung' && (
          <>
            <div className="grid2">
              <Field label="Tên bài (tiếng Trung)"><input value={l.title} onChange={(e) => set('title', e.target.value)} required /></Field>
              <Field label="Nghĩa tiếng Việt"><input value={l.vi} onChange={(e) => set('vi', e.target.value)} /></Field>
            </div>
            <label className="chk"><input type="checkbox" checked={!!l.free} onChange={(e) => set('free', e.target.checked)} /> 🎁 Miễn phí — ai cũng học được (học thử). Bỏ chọn = chỉ Học viên.</label>
            <fieldset><legend>Video bài giảng</legend>
              <p className="muted">Dán link YouTube (youtu.be/…, youtube.com/watch?v=…) để video phát ngay trên web. Link khác sẽ hiện nút mở trang riêng.</p>
              {(l.videos || []).map((v, i) => (
                <div key={i} className="grid2 vid-row">
                  <Field label={'Tên phần ' + (i + 1)}><input value={v.title || ''} onChange={(e) => set('videos', l.videos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} /></Field>
                  <Field label={ytId(v.url) ? '✓ YouTube — phát trên web' : 'Link video'}><input value={v.url} onChange={(e) => set('videos', l.videos.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)))} placeholder="https://youtu.be/…" /></Field>
                  <button type="button" className="btn-d small" onClick={() => set('videos', l.videos.filter((_, j) => j !== i))}>Xoá</button>
                </div>
              ))}
              <button type="button" className="btn-s small" onClick={() => set('videos', [...(l.videos || []), { title: 'Phần ' + ((l.videos || []).length + 1), url: '' }])}>+ Thêm video</button>
            </fieldset>
          </>
        )}
        {tab === 'vocab' && <Field label={'Từ vựng (' + (l.vocab || []).length + ' từ) — mỗi dòng “汉字 | pinyin | loại từ | nghĩa”; câu ví dụ ở dòng ngay dưới, bắt đầu bằng “- ”: “- 中文 | pinyin | nghĩa”'}><textarea rows={18} className="mono" defaultValue={vocabToText(l.vocab)} onBlur={(e) => set('vocab', textToVocab(e.target.value))} /></Field>}
        {tab === 'write' && <Field label="Các chữ Hán để luyện viết (viết liền, VD: 你好谢谢)" hint="Thứ tự nét lấy tự động từ thư viện Hanzi Writer."><textarea rows={3} value={l.write || ''} onChange={(e) => set('write', e.target.value)} lang="zh" /></Field>}
        {tab === 'grammar' && (
          <>
            {(l.grammar || []).map((g, i) => <GrammarEdit key={i} i={i} g={g} onChange={(x) => set('grammar', l.grammar.map((y, j) => (j === i ? x : y)))} onDel={() => set('grammar', l.grammar.filter((_, j) => j !== i))} />)}
            <button type="button" className="btn-s small" onClick={() => set('grammar', [...(l.grammar || []), { t: '', e: '', rule: '', note: '', ex: [], tip: '' }])}>+ Thêm điểm ngữ pháp</button>
          </>
        )}
        {tab === 'quiz' && (
          <>
            <p className="muted">Bài tập hiện dưới phần Ngữ pháp, học viên làm xong được chấm ngay.</p>
            {(l.quiz || []).map((q, i) => <QuizEdit key={i} i={i} q={q} onChange={(x) => set('quiz', l.quiz.map((y, j) => (j === i ? x : y)))} onDel={() => set('quiz', l.quiz.filter((_, j) => j !== i))} />)}
            <button type="button" className="btn-s small" onClick={() => set('quiz', [...(l.quiz || []), { type: 'choice', q: '', o: ['', ''], a: 0, why: '' }])}>+ Thêm câu hỏi</button>
          </>
        )}
        {tab === 'speak' && <Field label="Câu luyện nói — mỗi dòng “中文 | pinyin | nghĩa”"><textarea rows={12} defaultValue={rowsToText(l.speak)} onBlur={(e) => set('speak', textToRows(e.target.value))} /></Field>}
        <div className="form-act"><button type="button" className="btn-s" onClick={onClose}>Huỷ</button><button className="btn-p" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu bài học'}</button></div>
      </form>
    </Modal>
  );
}

export default function LessonsAdmin() {
  const { content, store, toast, reload } = useApp();
  const levels = content.stages.filter((s) => stageLevel(s));
  const [lv, setLv] = useState(1);
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const stage = levels.find((s) => stageLevel(s) === lv);
  const load = useCallback(() => { setList(null); store.listLessons(lv).then(setList, (e) => { toast(e.message, 'err'); setList([]); }); }, [lv, store, toast]);
  useEffect(() => { load(); }, [load]);
  const rows = (stage ? stage.lessons : []).map(([t, v], i) => (list || []).find((x) => x.n === i + 1) || { ...blank(lv, i + 1), title: t, vi: v, missing: true });
  const extra = (list || []).filter((x) => x.n > rows.length);
  const save = async (l) => { const { missing, ...x } = l; await store.saveLesson(x); await reload(); toast('Đã lưu bài ' + l.n + '.'); setEdit(null); load(); }; // eslint-disable-line no-unused-vars
  const importFiles = async (files) => {
    try {
      let all = [];
      for (const f of files) { const j = JSON.parse(await f.text()); all = all.concat(Array.isArray(j) ? j : [j]); }
      const ok = all.filter((x) => x && x.level >= 1 && x.level <= 6 && x.n >= 1);
      if (!ok.length) throw new Error('File không đúng định dạng bài học.');
      const n = await store.importLessons(ok); await reload(); toast('Đã nhập ' + n + ' bài học.'); load();
    } catch (e) { toast(e.message, 'err'); }
  };
  const exportLv = () => { const b = new Blob([JSON.stringify(list || [], null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = lv + '.json'; a.click(); };
  return (
    <>
      <div className="adm-top">
        <h1 className="adm-h">Bài học <small>Khoá học Mọt Tiếng Trung</small></h1>
        <div className="row-btns">
          <label className="btn-s">⬆ Nhập dữ liệu (.json)<input type="file" accept=".json,application/json" multiple hidden onChange={(e) => importFiles([...e.target.files])} /></label>
          <button type="button" className="btn-s" onClick={exportLv} disabled={!list}>⬇ Xuất HSK{lv}</button>
        </div>
      </div>
      <p className="note-box">Mỗi bài: video bài giảng (ghim giữa trang) + 5 phần ôn tập. Tên bài sửa ở đây sẽ cập nhật luôn danh sách bài trong lộ trình. Bài đánh dấu <b>🎁 Miễn phí</b> ai cũng học được; còn lại chỉ Học viên. Dữ liệu gốc từ bản HTML nằm ở thư mục <code>data/lessons</code> của dự án — dùng nút “Nhập dữ liệu” để đưa vào lần đầu.</p>
      <div className="seg">{levels.map((s) => <button key={s.id} type="button" className={stageLevel(s) === lv ? 'on' : ''} onClick={() => setLv(stageLevel(s))}>{s.title} · {s.key}</button>)}</div>
      {!list ? <p className="muted">Đang tải…</p> : (
        <div className="tbl-wrap">
          <table className="tbl-adm">
            <thead><tr><th>Bài</th><th>Tên bài</th><th>Video</th><th>Từ vựng</th><th>Viết</th><th>Ngữ pháp</th><th>Bài tập</th><th>Nói</th><th>Quyền</th><th /></tr></thead>
            <tbody>
              {[...rows, ...extra].map((l) => (
                <tr key={l.id} className={l.missing ? 'row-miss' : ''}>
                  <td>{l.n}</td>
                  <td><b lang="zh">{l.title}</b><span className="url">{l.vi}</span></td>
                  <td>{(l.videos || []).length ? (l.videos.every((v) => ytId(v.url)) ? '▶ ' : '🔗 ') + l.videos.length : '—'}</td>
                  <td>{(l.vocab || []).length || '—'}</td>
                  <td>{[...(l.write || '')].length || '—'}</td>
                  <td>{(l.grammar || []).length || '—'}</td>
                  <td>{(l.quiz || []).length || '—'}</td>
                  <td>{(l.speak || []).length || '—'}</td>
                  <td>{l.missing ? <span className="pill-s off">Chưa có nội dung</span> : l.free ? <span className="pill-s on">🎁 Miễn phí</span> : <span className="pill-s warn">⭐ Học viên</span>}</td>
                  <td className="acts"><button type="button" className="btn-s small" onClick={() => setEdit(l)}>{l.missing ? 'Soạn' : 'Sửa'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty>Chặng này chưa có danh sách bài. Thêm bài ở mục Lộ trình học (Sửa chặng › Danh sách bài học) hoặc nhập dữ liệu.</Empty>}
          <div className="row-btns" style={{ marginTop: 8 }}><button type="button" className="btn-s small" onClick={() => setEdit(blank(lv, rows.length + extra.length + 1))}>+ Thêm bài mới</button></div>
        </div>
      )}
      {edit && <LessonEditor initial={edit} onSave={save} onClose={() => setEdit(null)} />}
    </>
  );
}
