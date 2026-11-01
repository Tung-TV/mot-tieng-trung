import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { hasTest, passPct } from '../services/model.js';
import { nrm } from '../services/util.js';
import DocCard from '../components/DocCard.jsx';
import { Boxes, Chip, InfoBlock, Sections } from '../components/StageParts.jsx';
import { useStageStates } from './Roadmap.jsx';
import { hotSet, useDocActions } from './Library.jsx';

/** Trang chặn cho tài khoản chưa nâng cấp — không hiển thị bất kỳ nội dung/link nào của chặng */
export function UpgradeGate({ title = 'Nội dung dành cho Học viên' }) {
  const { user } = useApp();
  return (
    <section className="sk soon">
      <div className="soon-e">🔒</div>
      <h2>{title}</h2>
      <p>{user ? 'Tài khoản của bạn là tài khoản thường.' : 'Bạn chưa đăng nhập.'} Nâng cấp tài khoản Học viên để vào học từng chặng, xem tài liệu đi kèm và làm bài kiểm tra.</p>
      <div className="soon-a">
        <button className="btn-p" type="button" onClick={() => navigate('/nang-cap')}>⭐ Nâng cấp tài khoản</button>
        <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh')}>Xem khung lộ trình</button>
      </div>
    </section>
  );
}

function Quiz({ stage, onDone }) {
  const { store, toast, setUser, reload } = useApp();
  const qs = stage.test.questions;
  const [ans, setAns] = useState(() => qs.map(() => null));
  const [busy, setBusy] = useState(false);
  const left = ans.filter((x) => x === null).length;
  const submit = async (e) => {
    e.preventDefault();
    if (left) return toast('Bạn còn ' + left + ' câu chưa trả lời.', 'err');
    setBusy(true);
    try {
      const r = await store.submitTest(stage.id, ans);
      if (r.user) setUser(r.user);
      await reload();
      onDone(r);
    } catch (x) { toast(x.message || 'Không nộp được bài', 'err'); } finally { setBusy(false); }
  };
  return (
    <form className="quiz" onSubmit={submit}>
      {qs.map((q, i) => (
        <fieldset key={i} className={'qz' + (ans[i] !== null ? ' ok' : '')}>
          <legend><span className="qn">Câu {i + 1}</span>{q.q}</legend>
          {q.options.map((o, j) => (
            <label key={j} className={'opt' + (ans[i] === j ? ' on' : '')}>
              <input type="radio" name={'q' + i} checked={ans[i] === j} onChange={() => setAns(ans.map((x, k) => (k === i ? j : x)))} />
              <span className="ol">{'ABCD'[j] || j + 1}</span><span>{o}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="qz-foot">
        <span className="muted">{qs.length - left}/{qs.length} câu đã trả lời · cần đạt {passPct(stage)}%</span>
        <button className="btn-p" disabled={busy}>{busy ? 'Đang chấm…' : 'Nộp bài'}</button>
      </div>
    </form>
  );
}

function TestCard({ stage, idx, state, best, attempts }) {
  const { content, store, toast, setUser, reload } = useApp();
  const [mode, setMode] = useState('intro'); // intro | quiz | result
  const [res, setRes] = useState(null);
  const next = content.stages[idx + 1];

  if (!hasTest(stage)) {
    const complete = async () => {
      try { setUser(await store.completeStage(stage.id)); await reload(); toast('Đã hoàn thành chặng “' + stage.key + '”.'); } catch (x) { toast(x.message, 'err'); }
    };
    return (
      <section className="sk test-card">
        <h3>✅ Hoàn thành chặng</h3>
        {state === 'passed'
          ? <p>Bạn đã hoàn thành chặng này.{next && ' Chặng tiếp theo đã mở.'}</p>
          : <p>Chặng này chưa có bài kiểm tra. Học xong nội dung ở trên rồi bấm “Hoàn thành chặng” để mở chặng tiếp theo.</p>}
        <div className="row-btns">
          {state !== 'passed' && <button className="btn-p" type="button" onClick={complete}>Hoàn thành chặng</button>}
          {state === 'passed' && next && <button className="btn-p" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>Sang chặng “{next.key}” ›</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="sk test-card" id="kiem-tra">
      <h3>📝 Bài kiểm tra cuối chặng</h3>
      {mode === 'intro' && (
        <>
          <p>{stage.test.questions.length} câu trắc nghiệm · cần đạt <b>{passPct(stage)}%</b> để mở chặng tiếp theo · làm lại không giới hạn.</p>
          <div className="t-stats">
            <span>Trạng thái: <b className={state === 'passed' ? 'ok' : ''}>{state === 'passed' ? 'Đã đạt' : 'Chưa đạt'}</b></span>
            <span>Điểm cao nhất: <b>{best != null ? best + '%' : '—'}</b></span>
            <span>Số lần làm: <b>{attempts || 0}</b></span>
          </div>
          <div className="row-btns">
            <button className="btn-p" type="button" onClick={() => setMode('quiz')}>{attempts ? 'Làm lại bài kiểm tra' : 'Bắt đầu làm bài'}</button>
            {state === 'passed' && next && <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>Sang chặng “{next.key}” ›</button>}
          </div>
        </>
      )}
      {mode === 'quiz' && <Quiz stage={stage} onDone={(r) => { setRes(r); setMode('result'); window.scrollTo({ top: document.getElementById('kiem-tra').offsetTop - 12, behavior: 'smooth' }); }} />}
      {mode === 'result' && res && (
        <div className={'t-result ' + (res.passed ? 'pass' : 'fail')}>
          <div className="big">{res.pct}%</div>
          <p><b>{res.score}/{res.total}</b> câu đúng. {res.passed ? (next ? 'Chúc mừng! Bạn đã mở khoá chặng “' + next.key + '”.' : 'Chúc mừng! Bạn đã hoàn thành toàn bộ lộ trình.') : 'Chưa đạt ' + passPct(stage) + '%. Ôn lại bài học rồi thử lại nhé.'}</p>
          <div className="row-btns">
            {res.passed && next && <button className="btn-p" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>Sang chặng “{next.key}” ›</button>}
            <button className={res.passed ? 'btn-s' : 'btn-p'} type="button" onClick={() => setMode('quiz')}>Làm lại</button>
            <button className="btn-s" type="button" onClick={() => setMode('intro')}>Đóng</button>
          </div>
        </div>
      )}
    </section>
  );
}

function StageDocs({ stage }) {
  const { content } = useApp();
  const { saved, toggleSave, download } = useDocActions();
  const k = nrm((stage.keyword || '').trim());
  const docs = useMemo(() => (k ? content.documents.filter((d) => d.published !== false && nrm(d.name).includes(k)) : []), [content, k]);
  if (!docs.length) return null;
  const hot = hotSet(content.documents), maxDl = Math.max(1, ...content.documents.map((d) => d.downloads || 0));
  return (
    <section className="panel st-docs">
      <div className="head"><span>📚 Tài liệu cho chặng này <small>{docs.length} tài liệu</small></span></div>
      <div className="grid">{docs.slice(0, 8).map((d, i) => <DocCard key={d.id} doc={d} idx={'s' + i} hot={hot.has(d.id)} maxDl={maxDl} saved={saved.includes(d.id)} onSave={() => toggleSave(d.id)} onDownload={() => download(d.id)} />)}</div>
    </section>
  );
}

export default function StageDetail({ id }) {
  const { content, tier, progress, setProgress } = useApp();
  const states = useStageStates();
  if (tier !== 'student' && tier !== 'staff') return <UpgradeGate />;
  const idx = content.stages.findIndex((s) => s.id === id);
  const s = content.stages[idx];
  if (!s) return <section className="sk soon"><div className="soon-e">🔍</div><h2>Không tìm thấy chặng</h2><div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/lo-trinh')}>Về lộ trình</button></div></section>;
  const st = states[idx];
  const prev = content.stages[idx - 1], next = content.stages[idx + 1];
  if (st.state === 'locked') {
    return (
      <section className="sk soon">
        <div className="soon-e">🔒</div>
        <h2>Chặng “{s.key}” chưa mở</h2>
        <p>Vượt qua bài kiểm tra của chặng “{prev.key}” (đạt từ {passPct(prev)}%) để mở chặng này.</p>
        <div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/lo-trinh/' + prev.id)}>Tới chặng “{prev.key}”</button><button className="btn-s" type="button" onClick={() => navigate('/lo-trinh')}>Về lộ trình</button></div>
      </section>
    );
  }
  const owned = progress.owned || [];
  const toggleOwned = (k) => setProgress({ owned: owned.includes(k) ? owned.filter((x) => x !== k) : [...owned, k] });

  return (
    <div className="sd">
      <nav className="sd-nav">
        <button className="back" type="button" onClick={() => navigate('/lo-trinh')}>‹ Lộ trình</button>
        <span className="muted">Bậc {idx + 1}/{content.stages.length}</span>
      </nav>
      <section className="sk sd-head" style={{ '--c': s.color }}>
        <div className="sd-badge" style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }}><span>{s.emoji}</span>{s.key}</div>
        <div>
          <h1>{s.title}{!/cấp$/.test(s.badge) && s.badge && <span className="bd">{s.badge}</span>}</h1>
          <p>{s.desc}</p>
          <div className="chips">{(s.chips || []).map((c) => <Chip key={c} label={c} settings={content.settings} />)}</div>
        </div>
        <span className={'sd-state st-' + st.state}>{st.state === 'passed' ? '✓ Đã hoàn thành' : 'Đang học'}</span>
      </section>

      {((s.info || []).length > 0 || (s.sections || []).length > 0 || (s.boxes || []).length > 0) && (
        <section className="sk sd-body stage">
          {(s.info || []).length > 0 && <InfoBlock s={s} settings={content.settings} />}
          <Sections s={s} />
          <Boxes s={s} settings={content.settings} owned={owned} toggleOwned={toggleOwned} />
        </section>
      )}

      <StageDocs stage={s} />
      <TestCard key={s.id} stage={s} idx={idx} state={st.state} best={st.best} attempts={st.attempts} />

      <nav className="sd-pn">
        {prev ? <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh/' + prev.id)}>‹ {prev.key}</button> : <span />}
        {next && states[idx + 1].state !== 'locked' ? <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>{next.key} ›</button> : <span />}
      </nav>
    </div>
  );
}
