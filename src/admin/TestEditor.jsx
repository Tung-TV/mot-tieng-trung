// Soạn bài kiểm tra kiểu HSK: phần thi Nghe / Đọc / Viết / Nói, nhiều dạng câu hỏi, đáp án, điểm
import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { QTYPES, SKILLS, allQuestions, isManual, qPoints, rid, shuffled, testFromLessons } from '../services/model.js';
import { Field } from './ui.jsx';

const blankQ = (type = 'choice') => ({ id: rid('q'), type, prompt: '', points: type === 'write' || type === 'speak' ? 3 : 1, options: type === 'choice' ? ['', '', '', ''] : undefined, key: type === 'choice' || type === 'truefalse' ? { answer: 0 } : type === 'fill' ? { accept: [] } : type === 'order' ? { answer: [] } : { guide: '' } });
const blankS = (skill = 'reading') => ({ id: rid('s'), skill, title: '', intro: '', audio: '', image: '', passage: '', questions: [blankQ(skill === 'speaking' ? 'speak' : skill === 'writing' ? 'order' : 'choice')] });
const move = (arr, i, d) => { const a = arr.slice(); const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; };

/** Ô nhập tệp âm thanh / hình: dán link hoặc tải lên */
function MediaInput({ value, onChange, kind }) {
  const { store, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const up = async (f) => { if (!f) return; setBusy(true); try { onChange(await store.uploadMedia(f)); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); } };
  return (
    <div className="media-in">
      <input value={value && !value.startsWith('data:') ? value : value ? '(tệp đã tải lên)' : ''} readOnly={!!value && value.startsWith('data:')} onChange={(e) => onChange(e.target.value)} placeholder={kind === 'audio' ? 'Link tệp mp3 / m4a, hoặc tải lên' : 'Link ảnh, hoặc tải lên'} />
      <label className="btn-s small">{busy ? 'Đang tải…' : 'Tải lên'}<input type="file" hidden accept={kind === 'audio' ? 'audio/*' : 'image/*'} onChange={(e) => up(e.target.files[0])} /></label>
      {value && <button type="button" className="btn-s small" onClick={() => onChange('')}>Xoá</button>}
      {value && (kind === 'audio' ? <audio controls preload="none" src={value} /> : <img src={value} alt="" />)}
    </div>
  );
}

function QuestionEditor({ q, n, onChange, onRemove, onMove }) {
  const set = (patch) => onChange({ ...q, ...patch });
  const setKey = (patch) => onChange({ ...q, key: { ...(q.key || {}), ...patch } });
  const changeType = (type) => { const b = blankQ(type); onChange({ ...b, id: q.id, prompt: q.prompt, image: q.image }); };
  const opts = q.options || [];
  return (
    <div className="q-edit">
      <div className="q-head">
        <b>Câu {n}</b>
        <select value={q.type} onChange={(e) => changeType(e.target.value)}>{Object.entries(QTYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <label className="q-pts">Điểm <input type="number" min="0" step="0.5" value={q.points ?? 1} onChange={(e) => set({ points: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <span className="acts">
          <button type="button" className="btn-s small" onClick={() => onMove(-1)} aria-label="Lên">↑</button>
          <button type="button" className="btn-s small" onClick={() => onMove(1)} aria-label="Xuống">↓</button>
          <button type="button" className="btn-d small" onClick={onRemove}>Xoá</button>
        </span>
      </div>
      <Field label="Đề bài / câu hỏi"><textarea rows={2} value={q.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder={q.type === 'speak' ? 'VD: Đọc to câu sau…' : 'VD: 他是哪国人？'} /></Field>
      <Field label="Hình minh hoạ (tuỳ chọn)"><MediaInput kind="image" value={q.image || ''} onChange={(v) => set({ image: v })} /></Field>

      {q.type === 'choice' && (
        <div className="q-opts">
          {opts.map((o, j) => (
            <label key={j} className={'q-opt' + (q.key && q.key.answer === j ? ' on' : '')}>
              <input type="radio" name={'ans' + q.id} checked={!!q.key && q.key.answer === j} onChange={() => setKey({ answer: j })} title="Đáp án đúng" />
              <span>{'ABCDEF'[j]}</span>
              <input value={o} onChange={(e) => set({ options: opts.map((x, k) => (k === j ? e.target.value : x)) })} placeholder={'Lựa chọn ' + 'ABCDEF'[j] + ' (chữ hoặc link ảnh)'} />
              {opts.length > 2 && <button type="button" className="btn-s small" onClick={() => { set({ options: opts.filter((_, k) => k !== j) }); if (q.key.answer >= j && q.key.answer > 0) setKey({ answer: q.key.answer - 1 }); }} aria-label="Bỏ lựa chọn">×</button>}
            </label>
          ))}
          {opts.length < 6 && <button type="button" className="btn-s small" onClick={() => set({ options: [...opts, ''] })}>+ Lựa chọn</button>}
        </div>
      )}
      {q.type === 'truefalse' && (
        <div className="row-btns">{['Đúng', 'Sai'].map((l, j) => <label key={j} className={'q-opt' + (q.key && q.key.answer === j ? ' on' : '')}><input type="radio" name={'ans' + q.id} checked={!!q.key && q.key.answer === j} onChange={() => setKey({ answer: j })} /> Đáp án: {l}</label>)}</div>
      )}
      {q.type === 'fill' && <Field label="Đáp án được chấp nhận — mỗi dòng một cách viết" hint="Khi chấm bỏ qua dấu câu, khoảng trắng, chữ hoa/thường."><textarea rows={2} value={(q.key && q.key.accept || []).join('\n')} onChange={(e) => setKey({ accept: e.target.value.split('\n') })} /></Field>}
      {q.type === 'order' && <Field label="Câu đúng — các phần cách nhau bằng dấu /" hint="VD: 我/是/越南/人 → học viên thấy các phần đã xáo trộn và ghép lại."><input value={(q.key && q.key.answer || []).join('/')} onChange={(e) => setKey({ answer: e.target.value.split('/').map((x) => x.trim()).filter(Boolean) })} /></Field>}
      {isManual(q) && <Field label="Hướng dẫn chấm / bài mẫu (chỉ người chấm thấy)"><textarea rows={2} value={(q.key && q.key.guide) || ''} onChange={(e) => setKey({ guide: e.target.value })} /></Field>}
    </div>
  );
}

/** Kiểm tra + làm sạch bài kiểm tra trước khi lưu. Trả về { test } hoặc { error } */
export function cleanTest(t) {
  if (!t) return { test: null };
  const sections = [];
  let n = 0;
  for (const sec of t.sections) {
    const questions = [];
    for (const q0 of sec.questions) {
      n += 1;
      const q = { ...q0, prompt: (q0.prompt || '').trim(), points: qPoints(q0) };
      if (!q.prompt && !q.image) return { error: 'Câu ' + n + ': chưa có đề bài.' };
      if (q.type === 'choice') {
        const keep = (q.options || []).map((o, i) => [o.trim(), i]).filter(([o]) => o);
        if (keep.length < 2) return { error: 'Câu ' + n + ': cần ít nhất 2 lựa chọn.' };
        const ans = keep.findIndex(([, i]) => i === (q.key || {}).answer);
        if (ans < 0) return { error: 'Câu ' + n + ': chưa chọn đáp án đúng (hoặc đáp án đúng đang để trống).' };
        q.options = keep.map(([o]) => o); q.key = { answer: ans };
      } else if (q.type === 'truefalse') { q.key = { answer: (q.key || {}).answer === 1 ? 1 : 0 }; delete q.options; }
      else if (q.type === 'fill') {
        const acc = ((q.key || {}).accept || []).map((x) => x.trim()).filter(Boolean);
        if (!acc.length) return { error: 'Câu ' + n + ': chưa có đáp án điền từ.' };
        q.key = { accept: acc }; delete q.options;
      } else if (q.type === 'order') {
        const ans = ((q.key || {}).answer || []).filter(Boolean);
        if (ans.length < 2) return { error: 'Câu ' + n + ': câu sắp xếp cần ít nhất 2 phần (cách nhau bằng /).' };
        q.key = { answer: ans }; q.tokens = shuffled(ans, q.id); delete q.options;
      } else { q.key = { guide: ((q.key || {}).guide || '').trim() }; delete q.options; }
      if (!q.image) delete q.image;
      questions.push(q);
    }
    if (questions.length) sections.push({ ...sec, title: (sec.title || '').trim() || (SKILLS[sec.skill] || ['Phần'])[0], questions });
  }
  if (!sections.length) return { error: 'Bài kiểm tra chưa có câu hỏi nào. Bấm “Bỏ bài kiểm tra” nếu không cần.' };
  return { test: { pass: Math.min(100, Math.max(1, Number(t.pass) || 70)), minutes: Math.max(0, Number(t.minutes) || 0), sections } };
}

export default function TestEditor({ test, lessons, onChange }) {
  const { toast, ask } = useApp();
  const t = test;
  const setSec = (i, patch) => onChange({ ...t, sections: t.sections.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const sample = async () => {
    const x = testFromLessons(lessons);
    if (!x) return toast('Cần ít nhất 4 dòng trong “Danh sách bài học” để tạo bài mẫu.', 'err');
    if (t && allQuestions(t).length && !(await ask({ title: 'Thay bài kiểm tra', message: 'Bài mẫu sẽ thay toàn bộ câu hỏi hiện có.', danger: true, ok: 'Thay' }))) return;
    onChange(x);
  };
  if (!t) {
    return (
      <div className="row-btns">
        <button type="button" className="btn-p small" onClick={() => onChange({ pass: 70, minutes: 20, sections: [blankS('reading')] })}>+ Tạo bài kiểm tra</button>
        <button type="button" className="btn-s small" onClick={sample}>Tạo bài mẫu từ danh sách bài học</button>
      </div>
    );
  }
  const qs = allQuestions(t);
  let n = 0;
  return (
    <div className="t-edit">
      <div className="grid3">
        <Field label="Điểm đạt (%)" hint="Học viên cần đạt từ mức này để mở chặng sau"><input type="number" min="1" max="100" value={t.pass} onChange={(e) => onChange({ ...t, pass: e.target.value })} /></Field>
        <Field label="Thời gian làm bài (phút)" hint="0 = không giới hạn; hết giờ tự nộp"><input type="number" min="0" value={t.minutes || 0} onChange={(e) => onChange({ ...t, minutes: e.target.value })} /></Field>
        <div className="fld"><span>Tổng</span><b>{t.sections.length} phần · {qs.length} câu · {qs.reduce((s, q) => s + qPoints(q), 0)} điểm</b><small>{qs.some(isManual) ? 'Có câu chấm tay → học viên chờ chấm (CMS › Chấm bài)' : 'Tự chấm hoàn toàn'}</small></div>
      </div>
      {t.sections.map((sec, i) => (
        <div key={sec.id} className="sec-edit">
          <div className="q-head">
            <select value={sec.skill} onChange={(e) => setSec(i, { skill: e.target.value })}>{Object.entries(SKILLS).map(([k, [l, ic]]) => <option key={k} value={k}>{ic} {l}</option>)}</select>
            <input className="grow" value={sec.title} onChange={(e) => setSec(i, { title: e.target.value })} placeholder={'Tên phần, VD: Phần ' + (i + 1) + ' · ' + (SKILLS[sec.skill] || ['Phần'])[0]} />
            <span className="acts">
              <button type="button" className="btn-s small" onClick={() => onChange({ ...t, sections: move(t.sections, i, -1) })} aria-label="Lên">↑</button>
              <button type="button" className="btn-s small" onClick={() => onChange({ ...t, sections: move(t.sections, i, 1) })} aria-label="Xuống">↓</button>
              <button type="button" className="btn-d small" onClick={() => onChange({ ...t, sections: t.sections.filter((_, j) => j !== i) })}>Xoá phần</button>
            </span>
          </div>
          <Field label="Hướng dẫn làm bài"><input value={sec.intro || ''} onChange={(e) => setSec(i, { intro: e.target.value })} placeholder="VD: Nghe đoạn hội thoại và chọn đáp án đúng." /></Field>
          {(sec.skill === 'listening' || sec.audio) && <Field label="Tệp nghe (dùng chung cho cả phần)"><MediaInput kind="audio" value={sec.audio || ''} onChange={(v) => setSec(i, { audio: v })} /></Field>}
          {(sec.skill === 'reading' || sec.passage) && <Field label="Bài đọc (tuỳ chọn)"><textarea rows={3} value={sec.passage || ''} onChange={(e) => setSec(i, { passage: e.target.value })} lang="zh" /></Field>}
          <Field label="Hình chung cho phần (tuỳ chọn)"><MediaInput kind="image" value={sec.image || ''} onChange={(v) => setSec(i, { image: v })} /></Field>
          {sec.questions.map((q, j) => { n += 1; return (
            <QuestionEditor key={q.id} q={q} n={n}
              onChange={(nq) => setSec(i, { questions: sec.questions.map((x, k) => (k === j ? nq : x)) })}
              onRemove={() => setSec(i, { questions: sec.questions.filter((_, k) => k !== j) })}
              onMove={(d) => setSec(i, { questions: move(sec.questions, j, d) })} />
          ); })}
          <div className="row-btns">
            {Object.entries(QTYPES).map(([k, l]) => <button key={k} type="button" className="btn-s small" onClick={() => setSec(i, { questions: [...sec.questions, blankQ(k)] })}>+ {l.replace(/ \(.*\)/, '')}</button>)}
          </div>
        </div>
      ))}
      <div className="row-btns">
        {Object.entries(SKILLS).map(([k, [l, ic]]) => <button key={k} type="button" className="btn-s small" onClick={() => onChange({ ...t, sections: [...t.sections, blankS(k)] })}>+ Phần {ic} {l}</button>)}
        <button type="button" className="btn-s small" onClick={sample}>Tạo bài mẫu từ danh sách bài học</button>
        <button type="button" className="btn-d small" onClick={async () => (await ask({ title: 'Bỏ bài kiểm tra', message: 'Xoá toàn bộ câu hỏi của chặng này?', danger: true, ok: 'Bỏ' })) && onChange(null)}>Bỏ bài kiểm tra</button>
      </div>
    </div>
  );
}
