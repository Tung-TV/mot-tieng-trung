// Các phần ôn tập của một bài học: Luyện viết, Từ vựng, Nghe hiểu, Ngữ pháp, Luyện nói
import { useEffect, useMemo, useRef, useState } from 'react';
import { canListen, listen, say } from '../services/speech.js';
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

export function WritePart({ lesson, vocab }) {
  const chars = useMemo(() => [...new Set([...(lesson.write || '')].filter((c) => /[一-鿿]/.test(c)))], [lesson.write]);
  const [sel, setSel] = useState(chars[0] || '');
  const [mode, setMode] = useState('show');
  const [msg, setMsg] = useState('');
  const box = useRef(null), writer = useRef(null);
  useEffect(() => { setSel(chars[0] || ''); }, [chars]);
  useEffect(() => {
    if (!sel || !box.current) return undefined;
    let alive = true; setMsg('');
    box.current.innerHTML = '';
    loadHW().then((HW) => {
      if (!alive) return;
      writer.current = HW.create(box.current, sel, {
        width: 240, height: 240, padding: 12, showOutline: true, strokeColor: '#2b2a22', radicalColor: '#c0392b',
        outlineColor: '#e6dfc7', drawingColor: '#2f7d4f', highlightColor: '#ecb857', strokeAnimationSpeed: 1, delayBetweenStrokes: 200,
        charDataLoader: (c, ok, fail) => fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/' + encodeURIComponent(c) + '.json').then((r) => r.json()).then(ok, fail),
        onLoadCharDataError: () => alive && setMsg('Chưa có dữ liệu nét cho chữ này.'),
      });
      if (mode === 'show') writer.current.animateCharacter();
      else writer.current.quiz({ onComplete: (d) => alive && setMsg('🎉 Viết xong! Sai ' + d.totalMistakes + ' nét.') });
    }, (e) => alive && setMsg(e.message));
    return () => { alive = false; };
  }, [sel, mode]);
  if (!chars.length) return <Empty />;
  const w = vocab.find((x) => x.h.includes(sel));
  return (
    <div className="wr-x">
      <div className="wr-list" role="list">{chars.map((c) => <button key={c} type="button" role="listitem" className={'wr-c' + (c === sel ? ' on' : '')} onClick={() => setSel(c)} lang="zh">{c}</button>)}</div>
      <div className="wr-main">
        <div className="wr-box" ref={box} aria-label={'Chữ ' + sel} />
        <div className="wr-side">
          <div className="wr-big" lang="zh">{sel} <Spk t={sel} rate={0.6} /></div>
          {w && <p className="muted">{w.h} · {w.p} · {w.m}</p>}
          <div className="row-btns">
            <button type="button" className={mode === 'show' ? 'btn-p' : 'btn-s'} onClick={() => { setMode('show'); if (mode === 'show' && writer.current) writer.current.animateCharacter(); }}>▶ Xem cách viết</button>
            <button type="button" className={mode === 'quiz' ? 'btn-p' : 'btn-s'} onClick={() => setMode(mode === 'quiz' ? 'show' : 'quiz')}>✍️ Tự viết</button>
          </div>
          <small className="muted">{mode === 'quiz' ? 'Dùng chuột / ngón tay viết từng nét vào ô. Sai 3 lần Mọt sẽ gợi ý.' : 'Xem thứ tự nét rồi bấm “Tự viết” để luyện.'}</small>
          {msg && <p className="wr-msg">{msg}</p>}
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
export function SpeakPart({ speak }) {
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState(-1);
  if (!speak.length) return <Empty />;
  const go = async (i, s) => {
    setBusy(i);
    try { const r = await listen(s[0]); setRes({ ...res, [i]: r }); } catch (e) { setRes({ ...res, [i]: { err: e.message } }); } finally { setBusy(-1); }
  };
  return (
    <div>
      <p className="note-box">Bấm 🔊 nghe câu mẫu, rồi bấm 🎙 và đọc to. Mọt nhận giọng nói ngay trên trình duyệt và chấm độ giống với câu mẫu{canListen() ? '' : ' (trình duyệt này chưa hỗ trợ nhận giọng nói — hãy dùng Chrome hoặc Edge; bạn vẫn nghe mẫu và tự luyện được)'}.</p>
      <ol className="sp-list">{speak.map((s, i) => {
        const r = res[i];
        return (
          <li key={i} className="sp-i">
            <div className="sp-t"><span lang="zh">{s[0]}</span>{s[1] && <small>{s[1]}</small>}{s[2] && <small className="muted">{s[2]}</small>}</div>
            <div className="sp-a">
              <Spk t={s[0]} rate={0.75} label="🔊 Nghe mẫu" />
              {canListen() && <button type="button" className={'btn-p small' + (busy === i ? ' rec' : '')} disabled={busy >= 0} onClick={() => go(i, s)}>{busy === i ? '● Đang nghe…' : '🎙 Nói'}</button>}
            </div>
            {r && (r.err ? <div className="sp-r miss">{r.err}</div> : <div className={'sp-r ' + (r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'miss')}><b>{r.score}%</b> · Mọt nghe được: <span lang="zh">{r.text || '—'}</span>{r.score >= 80 ? ' 🎉' : ' — thử lại nhé'}</div>)}
          </li>
        );
      })}</ol>
    </div>
  );
}
