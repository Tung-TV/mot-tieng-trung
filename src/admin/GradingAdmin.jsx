// Chấm bài: phần tự luận (viết) và nói (ghi âm) của bài kiểm tra
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Overlays.jsx';
import { SKILLS, allQuestions, isManual, passPct, qPoints } from '../services/model.js';
import { nrm } from '../services/util.js';
import { Empty, Field } from './ui.jsx';

const dt = (t) => (t ? new Date(t).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function Recording({ ref0 }) {
  const { store } = useApp();
  const [u, setU] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { if (ref0) store.recordingUrl(ref0).then(setU, (e) => setErr(e.message)); }, [ref0, store]);
  if (!ref0) return <span className="muted">(Không có bản ghi)</span>;
  return err ? <span className="err">{err}</span> : u ? <audio controls src={u} /> : <span className="muted">Đang tải…</span>;
}

function GradeForm({ sub, stage, onDone, onClose }) {
  const { store, toast } = useApp();
  const manualQs = allQuestions(stage.test).filter(isManual);
  const [pts, setPts] = useState(() => Object.fromEntries(manualQs.map((q) => [q.id, sub.items && sub.items[q.id] != null ? sub.items[q.id] : ''])));
  const [fb, setFb] = useState(sub.feedback || '');
  const [busy, setBusy] = useState(false);
  const auto = Object.entries(sub.items || {}).filter(([id]) => !manualQs.some((q) => q.id === id)).reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const sum = auto + manualQs.reduce((n, q) => n + (Number(pts[q.id]) || 0), 0);
  const pct = sub.total ? Math.round((sum * 100) / sub.total) : 0;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await store.gradeSubmission(sub.id, Object.fromEntries(manualQs.map((q) => [q.id, Number(pts[q.id]) || 0])), fb.trim()); toast('Đã lưu điểm cho ' + sub.name + '.'); onDone(); }
    catch (x) { toast(x.message, 'err'); } finally { setBusy(false); }
  };
  let n = 0;
  return (
    <Modal title={'Chấm bài · ' + sub.name + ' · ' + (sub.stageKey || stage.key)} onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <p className="muted">{sub.email} · nộp {dt(sub.createdAt)} · phần tự chấm: <b>{auto}</b> điểm</p>
        {stage.test.sections.map((sec) => sec.questions.map((q) => { n += 1; if (!isManual(q)) return null; return (
          <div key={q.id} className="sec-edit">
            <div><span className="qn">Câu {n}</span> <span className="muted">{(SKILLS[sec.skill] || ['', ''])[1]} {sec.title}</span></div>
            <b>{q.prompt}</b>
            <div className="g-ans">{q.type === 'speak' ? <Recording ref0={sub.answers[q.id]} /> : <div className="ex-passage" lang="zh">{sub.answers[q.id] || <span className="muted">(Bỏ trống)</span>}</div>}</div>
            {q.key && q.key.guide && <small className="muted">Hướng dẫn chấm: {q.key.guide}</small>}
            <Field label={'Điểm (tối đa ' + qPoints(q) + ')'}><input type="number" min="0" max={qPoints(q)} step="0.5" value={pts[q.id]} onChange={(e) => setPts({ ...pts, [q.id]: e.target.value })} required /></Field>
          </div>
        ); }))}
        <Field label="Nhận xét gửi học viên"><textarea rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="VD: Viết đúng chữ, nhớ chú ý thanh điệu ở chữ 国." /></Field>
        <p>Tổng: <b>{sum}/{sub.total}</b> điểm = <b>{pct}%</b> → <b className={pct >= passPct(stage) ? 'ok' : 'err-t'}>{pct >= passPct(stage) ? 'ĐẠT' : 'CHƯA ĐẠT'}</b> (cần {passPct(stage)}%)</p>
        <div className="form-act"><button type="button" className="btn-s" onClick={onClose}>Huỷ</button><button className="btn-p" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu điểm'}</button></div>
      </form>
    </Modal>
  );
}

export default function GradingAdmin() {
  const { store, toast, content } = useApp();
  const [list, setList] = useState(null);
  const [f, setF] = useState('pending');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const load = useCallback(() => store.listSubmissions().then(setList, (e) => toast(e.message, 'err')), [store, toast]);
  useEffect(() => { load(); }, [load]);
  const stageOf = (id) => content.stages.find((s) => s.id === id);
  const shown = useMemo(() => (list || []).filter((x) => (f === 'all' || x.status === f) && (!q || nrm(x.name + ' ' + x.email + ' ' + (x.stageKey || '')).includes(nrm(q)))), [list, f, q]);
  if (!list) return <p className="muted">Đang tải…</p>;
  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Chấm bài <small>{list.filter((x) => x.status === 'pending').length} bài chờ chấm</small></h1><button className="btn-s" type="button" onClick={load}>Tải lại</button></div>
      <p className="note-box">Câu trắc nghiệm, đúng/sai, điền từ, sắp xếp câu được chấm tự động ngay khi học viên nộp. Ở đây chỉ chấm phần <b>Viết tự luận</b> và <b>Nói (ghi âm)</b>. Lưu điểm xong, kết quả và nhận xét hiện ngay cho học viên; đạt thì chặng sau tự mở.</p>
      <div className="adm-filter">
        <input type="search" placeholder="Tìm học viên, chặng…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={f} onChange={(e) => setF(e.target.value)}><option value="pending">Chờ chấm</option><option value="graded">Đã chấm</option><option value="all">Tất cả</option></select>
      </div>
      <div className="tbl-wrap">
        <table className="tbl-adm">
          <thead><tr><th>Học viên</th><th>Chặng</th><th>Nộp lúc</th><th>Điểm</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {shown.map((x) => {
              const st = stageOf(x.stageId);
              return (
                <tr key={x.id}>
                  <td><b>{x.name}</b><span className="url">{x.email}</span></td>
                  <td>{x.stageKey || (st && st.key)}</td>
                  <td className="muted">{dt(x.createdAt)}</td>
                  <td>{x.status === 'graded' ? <><b>{x.pct}%</b> <span className="url">{x.earned}/{x.total} điểm</span></> : <span className="url">tự chấm {x.auto}/{x.total - x.manualTotal}</span>}</td>
                  <td><span className={'pill-s ' + (x.status === 'pending' ? 'warn' : x.passed ? 'on' : 'off')}>{x.status === 'pending' ? 'Chờ chấm' : x.passed ? 'Đạt' : 'Chưa đạt'}</span></td>
                  <td className="acts">{st && x.manualTotal > 0 && <button type="button" className={x.status === 'pending' ? 'btn-p small' : 'btn-s small'} onClick={() => setOpen(x)}>{x.status === 'pending' ? 'Chấm bài' : 'Chấm lại'}</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <Empty>Không có bài nào.</Empty>}
      </div>
      {open && stageOf(open.stageId) && <GradeForm sub={open} stage={stageOf(open.stageId)} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </>
  );
}
