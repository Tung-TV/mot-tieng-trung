// Các phần ôn tập của một bài học: Luyện viết, Từ vựng, Nghe hiểu, Ngữ pháp, Luyện nói
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { canListen, canRecord, listen, say, startRecording } from '../services/speech.js';
import { useApp } from '../context/AppContext.jsx';
import { shuffled } from '../services/model.js';

const Spk = ({ t, rate, label = '🔊' }) => <button type="button" className="spk" onClick={() => say(t, rate)} aria-label={'Nghe: ' + t}>{label}</button>;
const Empty = ({ children }) => <div className="lsn-soon"><span className="em">🐛</span>{children || 'Phần này của bài đang được Mọt cập nhật.'}</div>;

// ---------- Luyện viết: thứ tự nét bằng Hanzi Writer (thư viện miễn phí, dữ liệu nét chữ tải từ CDN) ----------
let hwLoading = null;
const loadHW = () => {
  if (window.HanziWriter) return Promise.resolve(window.HanziWriter);
  if (!hwLoading) hwLoading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.7.2/dist/hanzi-writer.min.js';
    s.onload = () => res(window.HanziWriter); s.onerror = () => { hwLoading = null; rej(new Error('Không tải được công cụ luyện viết.')); };
    document.head.appendChild(s);
  });
  return hwLoading;
};

/** Ô tập viết tự do (luôn dùng được, kể cả khi không tải được dữ liệu nét chữ): chữ mẫu mờ phía sau, viết bằng chuột / ngón tay */
function DrawPad({ ch, guide }) {
  const cv = useRef(null), drawing = useRef(false);
  const paint = useCallback(() => {
    const c = cv.current; if (!c) return;
    const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
    if (guide) { x.fillStyle = 'rgba(43,42,34,.13)'; x.font = '200px "KaiTi","STKaiti","Kaiti SC","Noto Serif SC",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 120, 128); }
  }, [ch, guide]);
  useEffect(() => { paint(); }, [paint]);
  const pos = (e) => { const r = cv.current.getBoundingClientRect(); return [((e.clientX - r.left) * 240) / r.width, ((e.clientY - r.top) * 240) / r.height]; };
  const down = (e) => { e.preventDefault(); cv.current.setPointerCapture(e.pointerId); drawing.current = true; const x = cv.current.getContext('2d'); const [a, b] = pos(e); x.beginPath(); x.moveTo(a, b); x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#2b2a22'; };
  const move = (e) => { if (!drawing.current) return; const x = cv.current.getContext('2d'); const [a, b] = pos(e); x.lineTo(a, b); x.stroke(); };
  const up = () => { drawing.current = false; };
  return (
    <div className="dp-wrap">
      <canvas ref={cv} className="dp" width={240} height={240} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label={'Ô tập viết chữ ' + ch} />
      <button type="button" className="btn-s small" onClick={paint}>🧽 Xoá, viết lại</button>
    </div>
  );
}

export function WritePart({ lesson, vocab }) {
  const chars = useMemo(() => [...new Set([...(lesson.write || '')].filter((c) => /[\u4e00-\u9fff]/.test(c)))], [lesson.write]);
  const [sel, setSel] = useState(chars[0] || '');
  const [hw, setHw] = useState(null); // null: đang tải, true: có thư viện nét chữ, false: không tải được → ô viết tự do
  const [msg, setMsg] = useState('');
  const [guide, setGuide] = useState(true);
  const box = useRef(null), writer = useRef(null);
  useEffect(() => { setSel(chars[0] || ''); }, [chars]);
  const startQuiz = useCallback(() => {
    if (!writer.current) return;
    setMsg('✍️ Viết từng nét vào ô (kéo chuột hoặc ngón tay). Sai 3 lần Mọt sẽ gợi ý nét.');
    writer.current.quiz({ showHintAfterMisses: 3, onComplete: (d) => setMsg('🎉 Viết xong chữ ' + d.character + '! Sai ' + d.totalMistakes + ' nét. Bấm “Viết lại” để luyện tiếp.') });
  }, []);
  useEffect(() => {
    if (!sel || hw === false) return undefined;
    let alive = true; setMsg('');
    loadHW().then((HW) => {
      if (!alive || !box.current) return;
      box.current.innerHTML = '';
      writer.current = HW.create(box.current, sel, {
        width: 240, height: 240, padding: 12, showOutline: true, showCharacter: false, strokeColor: '#2b2a22', radicalColor: '#c0392b',
        outlineColor: '#e6dfc7', drawingColor: '#2f7d4f', drawingWidth: 18, highlightColor: '#ecb857', strokeAnimationSpeed: 1, delayBetweenStrokes: 200,
        charDataLoader: (c, ok, fail) => fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/' + encodeURIComponent(c) + '.json').then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(ok, fail),
        onLoadCharDataSuccess: () => { if (alive) { setHw(true); startQuiz(); } },
        onLoadCharDataError: () => alive && setHw(false),
      });
    }, () => alive && setHw(false));
    return () => { alive = false; };
  }, [sel, hw === false, startQuiz]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chars.length) return <Empty />;
  const w = vocab.find((x) => x.h.includes(sel));
  const show = () => { if (!writer.current) return; writer.current.cancelQuiz(); setMsg('👀 Xem thứ tự nét…'); writer.current.animateCharacter({ onComplete: startQuiz }); };
  return (
    <div className="wr-x">
      <div className="wr-list" role="list">{chars.map((c) => <button key={c} type="button" role="listitem" className={'wr-c' + (c === sel ? ' on' : '')} onClick={() => setSel(c)} lang="zh">{c}</button>)}</div>
      <div className="wr-main">
        {hw === false ? <DrawPad ch={sel} guide={guide} /> : <div className="wr-box" ref={box} aria-label={'Ô tập viết chữ ' + sel} />}
        <div className="wr-side">
          <div className="wr-big" lang="zh">{sel} <Spk t={sel} rate={0.6} /></div>
          {w && <p className="muted">{w.h} · {w.p} · {w.m}</p>}
          {hw === false ? (
            <>
              <label className="chk"><input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} /> Hiện chữ mẫu mờ để tô theo</label>
              <small className="muted">Không tải được dữ liệu thứ tự nét (mạng chặn), bạn vẫn tô / viết tự do vào ô bên cạnh.</small>
            </>
          ) : (
            <div className="row-btns">
              <button type="button" className="btn-p" onClick={show} disabled={!hw}>▶ Xem cách viết</button>
              <button type="button" className="btn-s" onClick={startQuiz} disabled={!hw}>↺ Viết lại</button>
              <button type="button" className="btn-s" onClick={() => setHw(false)}>✏️ Viết tự do</button>
            </div>
          )}
          {hw === null && <small className="muted">Đang tải thứ tự nét…</small>}
          {msg && hw && <p className="wr-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Từ vựng: danh sách + lật thẻ ----------
export function VocabPart({ vocab }) {
  const [mode, setMode] = useState('list');
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (!vocab.length) return <Empty />;
  const w = vocab[i % vocab.length];
  return (
    <div>
      <div className="seg"><button type="button" className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>📋 Danh sách</button><button type="button" className={mode === 'card' ? 'on' : ''} onClick={() => setMode('card')}>🃏 Lật thẻ</button></div>
      {mode === 'list' ? (
        <div className="vc-grid">{vocab.map((x, k) => (
          <article key={k} className="vc-c">
            <div className="vc-h"><b lang="zh">{x.h}</b><Spk t={x.h} rate={0.7} /></div>
            <div className="vc-p">{x.p}{x.t && <em>{x.t}</em>}</div>
            <div className="vc-m">{x.m}</div>
            {(x.e || []).slice(0, 2).map((e, j) => <div key={j} className="vc-e"><span lang="zh">{e[0]}</span><Spk t={e[0]} /><small>{e[1]}</small><small>{e[2]}</small></div>)}
          </article>
        ))}</div>
      ) : (
        <div className="fc-wrap">
          <button type="button" className={'fc' + (flip ? ' flip' : '')} onClick={() => { setFlip(!flip); if (!flip) say(w.h, 0.7); }}>
            {!flip ? <span className="fc-f" lang="zh">{w.h}</span> : <span className="fc-b"><b>{w.p}</b><span>{w.m}</span>{w.t && <em>{w.t}</em>}</span>}
          </button>
          <div className="row-btns"><button type="button" className="btn-s" onClick={() => { setI((i - 1 + vocab.length) % vocab.length); setFlip(false); }}>‹ Trước</button><span className="muted">{(i % vocab.length) + 1}/{vocab.length}</span><button type="button" className="btn-p" onClick={() => { setI(i + 1); setFlip(false); }}>Tiếp ›</button></div>
        </div>
      )}
    </div>
  );
}

// ---------- Nghe hiểu: nghe từ / câu, chọn nghĩa đúng ----------
export function ListenPart({ vocab, onScore }) {
  const make = () => shuffled(vocab, String(Date.now())).slice(0, Math.min(10, vocab.length)).map((w) => {
    const wrong = shuffled(vocab.filter((x) => x.m !== w.m), String(Math.random())).slice(0, 3).map((x) => x.m);
    const o = shuffled([w.m, ...wrong], String(Math.random()));
    return { w, o, a: o.indexOf(w.m) };
  });
  const [qs, setQs] = useState(() => (vocab.length >= 2 ? make() : []));
  const [k, setK] = useState(0);
  const [pick, setPick] = useState(null);
  const [ok, setOk] = useState(0);
  const q = qs[k];
  useEffect(() => { if (q && pick === null) { const t = setTimeout(() => say(q.w.h, 0.7), 250); return () => clearTimeout(t); } return undefined; }, [k, q, pick]);
  if (vocab.length < 2) return <Empty />;
  if (k >= qs.length) {
    return (
      <div className="dr-res"><div className="dr-score"><b>{ok}</b>/{qs.length}</div><h4>{ok >= qs.length * 0.8 ? 'Tai nghe rất tốt! 🎉' : 'Nghe thêm vài lần sẽ quen tai nhé! 💪'}</h4>
        <div className="row-btns"><button type="button" className="btn-p" onClick={() => { setQs(make()); setK(0); setOk(0); setPick(null); }}>Làm lại ›</button></div></div>
    );
  }
  const answer = (j) => { if (pick !== null) return; setPick(j); const good = j === q.a; if (good) setOk(ok + 1); if (k === qs.length - 1 && onScore) onScore(Math.round(((ok + (good ? 1 : 0)) / qs.length) * 100)); };
  return (
    <div className="ls-q">
      <div className="ls-top"><span>Câu {k + 1}/{qs.length}</span><span>Đúng: {ok}</span></div>
      <button type="button" className="ls-play" onClick={() => say(q.w.h, 0.7)}>🔊 Nghe lại</button>
      <div className="ls-opts">{q.o.map((o, j) => <button key={j} type="button" disabled={pick !== null} className={'lo' + (pick !== null && j === q.a ? ' ok' : pick === j ? ' bad' : '')} onClick={() => answer(j)}><kbd>{j + 1}</kbd><b>{o}</b></button>)}</div>
      {pick !== null && <div className={'dr-fb ' + (pick === q.a ? 'good' : 'miss')}>{pick === q.a ? '✅ Chính xác! ' : '❌ Chưa đúng. '}<b lang="zh">{q.w.h}</b> ({q.w.p}): {q.w.m}<button type="button" className="btn-p small" onClick={() => { setK(k + 1); setPick(null); }}>{k === qs.length - 1 ? 'Xem kết quả ›' : 'Câu tiếp ›'}</button></div>}
    </div>
  );
}

// ---------- Ngữ pháp: điểm ngữ pháp + bài tập ----------
function OrderQ({ q, onDone }) {
  const pool = useMemo(() => shuffled(q.w.map((t, i) => ({ t, i })), q.q), [q]);
  const [sel, setSel] = useState([]);
  const [res, setRes] = useState(null);
  const left = pool.filter((p) => !sel.includes(p.i));
  const check = () => { const good = sel.map((i) => q.w[i]).join('') === q.w.join(''); setRes(good); onDone(good); };
  return (
    <div>
      <div className="eo-ans">{sel.length ? sel.map((i, k) => <button key={k} type="button" className="eo-tk on" disabled={res !== null} onClick={() => setSel(sel.filter((x) => x !== i))} lang="zh">{q.w[i]}</button>) : <span className="muted">Bấm các chữ theo thứ tự đúng</span>}</div>
      <div className="eo-pool">{left.map((p) => <button key={p.i} type="button" className="eo-tk" disabled={res !== null} onClick={() => setSel([...sel, p.i])} lang="zh">{p.t}</button>)}</div>
      {res === null ? <button type="button" className="btn-p small" disabled={sel.length !== q.w.length} onClick={check}>Kiểm tra</button>
        : <div className={'dr-fb ' + (res ? 'good' : 'miss')}>{res ? '✅ Chính xác! ' : '❌ Đáp án: '}<b lang="zh">{q.w.join('')}</b>{q.h && <small> · {q.h}</small>}<Spk t={q.w.join('')} /></div>}
    </div>
  );
}

export function GrammarPart({ grammar, quiz, onScore }) {
  const [k, setK] = useState(0);
  const [pick, setPick] = useState(null);
  const [ok, setOk] = useState(0);
  const [done, setDone] = useState(false);
  const qs = quiz || [];
  const q = qs[k];
  const next = () => { if (k + 1 >= qs.length) { setDone(true); if (onScore) onScore(Math.round((ok / qs.length) * 100)); } else { setK(k + 1); setPick(null); } };
  return (
    <div>
      {!grammar.length && !qs.length && <Empty />}
      <div className="gm-list">{grammar.map((g, i) => (
        <details key={i} className="gm-c" open={i === 0}>
          <summary><span className="gm-n">{i + 1}</span>{g.e && <span aria-hidden="true">{g.e} </span>}<b>{g.t}</b></summary>
          {g.rule && <div className="gm-rule" lang="zh">{g.rule}</div>}
          {g.note && <p>{g.note}</p>}
          {(g.ex || []).map((x, j) => <div key={j} className="gm-ex"><span lang="zh">{x[0]}</span><Spk t={x[0]} />{x[1] && <small>{x[1]}</small>}{x[2] && <small>{x[2]}</small>}</div>)}
          {g.tip && <div className="gm-tip">💡 {g.tip}</div>}
        </details>
      ))}</div>
      {qs.length > 0 && (
        <section className="gm-quiz">
          <h4>🧩 Bài tập ngữ pháp {done ? '' : `· câu ${k + 1}/${qs.length}`}</h4>
          {done ? (
            <div className="dr-res"><div className="dr-score"><b>{ok}</b>/{qs.length}</div><div className="row-btns"><button type="button" className="btn-p" onClick={() => { setK(0); setOk(0); setPick(null); setDone(false); }}>Làm lại ›</button></div></div>
          ) : q.type === 'order' ? (
            <div key={k}><p className="gm-qq">{q.q}</p><OrderQ q={q} onDone={(g) => { if (g) setOk(ok + 1); setPick(0); }} />{pick !== null && <button type="button" className="btn-p small" onClick={next}>{k + 1 >= qs.length ? 'Xem kết quả ›' : 'Câu tiếp ›'}</button>}</div>
          ) : (
            <div key={k}>
              <p className="gm-qq" lang="zh">{q.q}</p>
              <div className="ls-opts">{(q.o || []).map((o, j) => <button key={j} type="button" disabled={pick !== null} className={'lo' + (pick !== null && j === q.a ? ' ok' : pick === j ? ' bad' : '')} onClick={() => { setPick(j); if (j === q.a) setOk(ok + 1); }}><kbd>{'ABCD'[j]}</kbd><b lang="zh">{o}</b></button>)}</div>
              {pick !== null && <div className={'dr-fb ' + (pick === q.a ? 'good' : 'miss')}>{pick === q.a ? '✅ Chính xác! ' : '❌ Đáp án: ' + q.o[q.a] + '. '}{q.why}<button type="button" className="btn-p small" onClick={next}>{k + 1 >= qs.length ? 'Xem kết quả ›' : 'Câu tiếp ›'}</button></div>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---------- Luyện nói: nghe mẫu, nói theo, máy nhận giọng và chấm độ giống ----------
function AiBox({ r }) {
  if (r.err) return <div className="sp-r miss">🤖 {r.err}</div>;
  return (
    <div className={'sp-ai ' + (r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'miss')}>
      <div className="sp-ai-h"><b>🤖 AI chấm: {r.score}%</b><span>AI nghe được: <span lang="zh">{r.heard || '—'}</span></span></div>
      {(r.mistakes || []).length > 0 && <ul className="sp-ai-m">{r.mistakes.map((m, i) => <li key={i}><b lang="zh">{m.want}</b>{m.got ? <> → <span lang="zh">{m.got}</span></> : null}{m.note ? <small>{m.note}</small> : null}</li>)}</ul>}
      {r.comment && <p>{r.comment}</p>}
      {r.tip && <p className="sp-ai-tip">💡 {r.tip}</p>}
      {r.left != null && <small className="muted">Còn {r.left} lượt chấm AI hôm nay.</small>}
    </div>
  );
}

/** Luyện nói: nghe mẫu, nói theo. Ai cũng dùng được nhận giọng trên trình duyệt; AI chấm phát âm chỉ dành cho Học viên. */
export function SpeakPart({ speak }) {
  const { tier, store, setUpgradeOpen } = useApp();
  const pro = tier === 'student' || tier === 'staff';
  const [res, setRes] = useState({});
  const [ai, setAi] = useState({});
  const [busy, setBusy] = useState(-1);
  const [rec, setRec] = useState(null); // { i, h } đang ghi âm cho AI
  if (!speak.length) return <Empty />;
  const go = async (i, s) => {
    setBusy(i);
    try { const r = await listen(s[0]); setRes((x) => ({ ...x, [i]: r })); } catch (e) { setRes((x) => ({ ...x, [i]: { err: e.message } })); } finally { setBusy(-1); }
  };
  const finishAi = async (i, s, h) => {
    setRec(null); setBusy(i); setAi((x) => ({ ...x, [i]: { wait: true } }));
    try { const wav = await h.stop(); const r = await store.aiSpeak(wav, s); setAi((x) => ({ ...x, [i]: r })); }
    catch (e) { setAi((x) => ({ ...x, [i]: { err: e.message } })); } finally { setBusy(-1); }
  };
  const aiGo = async (i, s) => {
    if (!pro) { setUpgradeOpen(true); return; }
    if (rec && rec.i === i) { finishAi(i, s, rec.h); return; }
    try { let h; h = await startRecording(12, () => finishAi(i, s, h)); setRec({ i, h }); } catch { setAi((x) => ({ ...x, [i]: { err: 'Không mở được micro. Hãy cho phép trình duyệt dùng micro.' } })); }
  };
  return (
    <div>
      <p className="note-box">Bấm 🔊 nghe câu mẫu rồi đọc theo. <b>🎙 Nói</b>: trình duyệt nhận giọng và chấm độ giống (miễn phí{canListen() ? '' : ', cần Chrome hoặc Edge'}). <b>🤖 AI chấm</b>: AI nghe bản ghi của bạn, chỉ ra chữ đọc sai và cách sửa{pro ? '' : ' — dành cho Học viên'}.</p>
      <ol className="sp-list">{speak.map((s, i) => {
        const r = res[i], a = ai[i], recing = rec && rec.i === i;
        return (
          <li key={i} className="sp-i">
            <div className="sp-t"><span lang="zh">{s[0]}</span>{s[1] && <small>{s[1]}</small>}{s[2] && <small className="muted">{s[2]}</small>}</div>
            <div className="sp-a">
              <Spk t={s[0]} rate={0.75} label="🔊 Nghe mẫu" />
              {canListen() && <button type="button" className={'btn-s small' + (busy === i && !a ? ' rec' : '')} disabled={busy >= 0 || !!rec} onClick={() => go(i, s)}>{busy === i && !(a && a.wait) ? '● Đang nghe…' : '🎙 Nói'}</button>}
              {canRecord() && <button type="button" className={'btn-p small sp-aib' + (recing ? ' rec' : '') + (pro ? '' : ' lock')} disabled={(busy >= 0 && !recing) || (!!rec && !recing)} onClick={() => aiGo(i, s)}>{recing ? '■ Dừng & chấm' : a && a.wait ? '🤖 AI đang chấm…' : pro ? '🤖 AI chấm' : '🔒 AI chấm · Học viên'}</button>}
            </div>
            {recing && <small className="muted">● Đang ghi âm — đọc câu mẫu rồi bấm “Dừng & chấm” (tối đa 12 giây).</small>}
            {r && (r.err ? <div className="sp-r miss">{r.err}</div> : <div className={'sp-r ' + (r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'miss')}><b>{r.score}%</b> · Trình duyệt nghe được: <span lang="zh">{r.text || '—'}</span>{r.score >= 80 ? ' 🎉' : ' — thử lại nhé'}</div>)}
            {a && !a.wait && <AiBox r={a} />}
          </li>
        );
      })}</ol>
    </div>
  );
}
