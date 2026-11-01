// Phòng thi kiểu HSK: các phần Nghe / Đọc / Viết / Nói, nhiều dạng câu hỏi, đồng hồ đếm ngược, ghi âm
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { SKILLS, allQuestions, isManual, passPct, qPoints, shuffled } from '../services/model.js';

const TF = ['Đúng', 'Sai'];

function Media({ sec }) {
  return (
    <>
      {sec.audio && <audio className="ex-audio" controls preload="none" src={sec.audio}>Trình duyệt không phát được âm thanh.</audio>}
      {sec.image && <img className="ex-img" src={sec.image} alt="" />}
      {sec.passage && <div className="ex-passage">{sec.passage}</div>}
    </>
  );
}

function OrderInput({ q, value, onChange }) {
  const tokens = q.tokens || [];
  const used = value || [];
  // đếm số lần mỗi chữ đã dùng (có thể trùng chữ)
  const left = useMemo(() => {
    const cnt = {}; used.forEach((t) => (cnt[t] = (cnt[t] || 0) + 1));
    return tokens.map((t, i) => ({ t, i })).filter(({ t }) => (cnt[t] ? (cnt[t]--, false) : true));
  }, [tokens, used]);
  return (
    <div className="ex-order">
      <div className="eo-ans" aria-label="Câu bạn ghép">
        {used.length ? used.map((t, i) => <button key={i} type="button" className="eo-tk on" onClick={() => onChange(used.filter((_, j) => j !== i))} title="Bấm để bỏ">{t}</button>) : <span className="muted">Bấm các chữ bên dưới theo thứ tự đúng</span>}
      </div>
      <div className="eo-pool">
        {left.map(({ t, i }) => <button key={i} type="button" className="eo-tk" onClick={() => onChange([...used, t])}>{t}</button>)}
        {used.length > 0 && <button type="button" className="btn-s small" onClick={() => onChange([])}>Làm lại</button>}
      </div>
    </div>
  );
}

function Recorder({ value, onChange }) {
  const { store, toast } = useApp();
  const [rec, setRec] = useState(null);
  const [sec, setSec] = useState(0);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState('');
  const chunks = useRef([]);
  useEffect(() => { let alive = true; if (value) store.recordingUrl(value).then((u) => alive && setUrl(u), () => {}); else setUrl(''); return () => { alive = false; }; }, [value, store]);
  useEffect(() => { if (!rec) return undefined; const t = setInterval(() => setSec((s) => { if (s >= 89) rec.stop(); return s + 1; }), 1000); return () => clearInterval(t); }, [rec]);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 } : undefined);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); setRec(null); setBusy(true);
        try { onChange(await store.uploadRecording(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }))); } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
      };
      mr.start(); setSec(0); setRec(mr);
    } catch { toast('Không mở được micro. Hãy cho phép trình duyệt dùng micro rồi thử lại.', 'err'); }
  };
  return (
    <div className="ex-rec">
      {rec ? <button type="button" className="btn-d" onClick={() => rec.stop()}>■ Dừng ({sec}s)</button>
        : <button type="button" className="btn-p" disabled={busy} onClick={start}>{busy ? 'Đang lưu…' : value ? '🎙 Ghi lại' : '🎙 Ghi âm'}</button>}
      {url && !rec && <audio controls src={url} />}
      <small className="muted">Tối đa 90 giây.</small>
    </div>
  );
}

function Question({ q, n, value, onChange, result }) {
  const mark = result && result[q.id];
  return (
    <fieldset className={'qz' + (value !== undefined && value !== '' && !(Array.isArray(value) && !value.length) ? ' ok' : '') + (mark === undefined || mark === null ? '' : mark > 0 ? ' right' : ' wrong')}>
      <legend><span className="qn">Câu {n}</span>{q.prompt}<span className="qp">{qPoints(q)} điểm{isManual(q) ? ' · chấm tay' : ''}</span></legend>
      {q.image && <img className="ex-img" src={q.image} alt="" />}
      {(q.type === 'choice' || q.type === 'truefalse') && (q.type === 'truefalse' ? TF : q.options || []).map((o, j) => (
        <label key={j} className={'opt' + (Number(value) === j && value !== undefined ? ' on' : '')}>
          <input type="radio" name={q.id} checked={value !== undefined && Number(value) === j} onChange={() => onChange(j)} disabled={!!result} />
          <span className="ol">{q.type === 'truefalse' ? (j ? '✗' : '✓') : 'ABCDEF'[j]}</span>
          {/^(https?:|data:image)/.test(o) ? <img className="opt-img" src={o} alt={'Lựa chọn ' + 'ABCDEF'[j]} /> : <span>{o}</span>}
        </label>
      ))}
      {q.type === 'fill' && <input className="ex-fill" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Nhập câu trả lời" disabled={!!result} lang="zh" />}
      {q.type === 'order' && (result ? <div className="eo-ans">{(value || []).map((t, i) => <span key={i} className="eo-tk on">{t}</span>)}</div> : <OrderInput q={q} value={value} onChange={onChange} />)}
      {q.type === 'write' && <textarea className="ex-write" rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Viết câu trả lời của bạn" disabled={!!result} lang="zh" />}
      {q.type === 'speak' && (result ? <small className="muted">Đã nộp bản ghi âm.</small> : <Recorder value={value} onChange={onChange} />)}
      {mark !== undefined && <div className="q-mark">{mark === null ? '⏳ Chờ chấm' : mark > 0 ? '✓ Đúng' : '✗ Chưa đúng'}</div>}
    </fieldset>
  );
}

const answered = (v) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);

/** Bài thi: onSubmit(answers) phải trả về kết quả; hiện kết quả từng câu sau khi nộp */
export default function Exam({ stage, onSubmit, onClose }) {
  const { ask, toast } = useApp();
  const test = stage.test;
  const qs = allQuestions(test);
  const [ans, setAns] = useState({});
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState((Number(test.minutes) || 0) * 60);
  const sent = useRef(false);
  const doneN = qs.filter((q) => answered(ans[q.id])).length;

  const submit = async (force) => {
    if (sent.current) return;
    if (!force && doneN < qs.length && !(await ask({ title: 'Nộp bài', message: 'Bạn còn ' + (qs.length - doneN) + ' câu chưa làm. Vẫn nộp bài?', ok: 'Nộp bài' }))) return;
    sent.current = true; setBusy(true);
    try { setRes(await onSubmit(ans)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { sent.current = false; toast(e.message || 'Không nộp được bài', 'err'); } finally { setBusy(false); }
  };
  // đồng hồ đếm ngược: hết giờ tự nộp
  useEffect(() => {
    if (!test.minutes || res) return undefined;
    const t = setInterval(() => setLeft((s) => { if (s <= 1) { clearInterval(t); submit(true); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [test.minutes, res]); // eslint-disable-line react-hooks/exhaustive-deps

  let n = 0;
  return (
    <div className="exam">
      {res && (
        <div className={'t-result ' + (res.status === 'pending' ? 'wait' : res.passed ? 'pass' : 'fail')}>
          {res.status === 'pending' ? (
            <>
              <div className="big">⏳</div>
              <p><b>Đã nộp bài.</b> Phần tự động: <b>{res.earned}/{res.total - res.manual}</b> điểm. Phần tự luận / nói ({res.manual} điểm) đang chờ giáo viên chấm. Kết quả và nhận xét sẽ hiện ở trang này.</p>
            </>
          ) : (
            <>
              <div className="big">{res.pct}%</div>
              <p><b>{res.earned}/{res.total}</b> điểm. {res.passed ? 'Chúc mừng! Bạn đã đạt bài kiểm tra.' : 'Chưa đạt ' + passPct(stage) + '%. Ôn lại bài rồi thử lại nhé.'}</p>
            </>
          )}
          <div className="row-btns"><button type="button" className="btn-p" onClick={() => onClose(res)}>Xong</button></div>
        </div>
      )}
      {test.sections.map((sec) => (
        <section key={sec.id} className="ex-sec">
          <h4><span className="ex-skill">{(SKILLS[sec.skill] || ['', '📝'])[1]} {(SKILLS[sec.skill] || ['Phần'])[0]}</span>{sec.title}</h4>
          {sec.intro && <p className="muted">{sec.intro}</p>}
          <Media sec={sec} />
          {sec.questions.map((q) => { n += 1; return <Question key={q.id} q={{ ...q, tokens: q.type === 'order' ? q.tokens || shuffled(q.key ? q.key.answer : [], q.id) : undefined }} n={n} value={ans[q.id]} result={res && res.items} onChange={(v) => setAns({ ...ans, [q.id]: v })} />; })}
        </section>
      ))}
      {!res && (
        <div className="qz-foot">
          <span className="muted">{doneN}/{qs.length} câu đã làm · cần đạt {passPct(stage)}%{test.minutes ? <> · còn <b className={left < 60 ? 'warn' : ''}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b></> : null}</span>
          <div className="row-btns">
            <button type="button" className="btn-s" onClick={async () => (await ask({ title: 'Thoát bài thi', message: 'Bài làm chưa nộp sẽ mất.', danger: true, ok: 'Thoát' })) && onClose(null)}>Thoát</button>
            <button type="button" className="btn-p" disabled={busy} onClick={() => submit(false)}>{busy ? 'Đang nộp…' : 'Nộp bài'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
