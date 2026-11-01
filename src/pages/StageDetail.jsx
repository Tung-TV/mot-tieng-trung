import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { SKILLS, allQuestions, byButton, canEnterStage, hasTest, isManual, passPct, qPoints } from '../services/model.js';
import Exam from '../components/Exam.jsx';
import { nrm } from '../services/util.js';
import DocCard from '../components/DocCard.jsx';
import { Boxes, Chip, InfoBlock, Sections } from '../components/StageParts.jsx';
import { useStageStates } from './Roadmap.jsx';
import { hotSet, useDocActions } from './Library.jsx';

/** Trang chặn cho tài khoản chưa nâng cấp — không hiển thị bất kỳ nội dung/link nào của chặng */
export function UpgradeGate({ title = 'Nội dung dành cho Học viên' }) {
  const { user, setAuthOpen } = useApp();
  return (
    <section className="sk soon">
      <div className="soon-e">🔒</div>
      <h2>{title}</h2>
      <p>Phần này thuộc <b>Khoá học Mọt Tiếng Trung</b>: video bài giảng, ôn tập từng bài, bài kiểm tra và tài liệu dành riêng. {user ? 'Đăng ký khoá học để vào học.' : 'Đăng nhập rồi đăng ký khoá học để vào học.'}</p>
      <div className="soon-a">
        <button className="btn-p" type="button" onClick={() => navigate('/khoa-hoc')}>🎓 Xem khoá học</button>
        {!user && <button className="btn-s" type="button" onClick={() => setAuthOpen('login')}>Đăng nhập</button>}
        <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh')}>Xem lộ trình</button>
      </div>
    </section>
  );
}

function TestCard({ stage, idx, st }) {
  const { content, store, toast, setUser, reload, tier, user, setAuthOpen } = useApp();
  const [taking, setTaking] = useState(false);
  const [subs, setSubs] = useState(null);
  const next = content.stages[idx + 1];
  const nextBtn = next && <button className="btn-p" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>Sang chặng “{next.key}” ›</button>;
  useEffect(() => { if (!byButton(stage) && user) store.mySubmissions(stage.id).then(setSubs, () => setSubs([])); }, [stage, store, st.attempts, st.pending, user]);
  if (!user) {
    return (
      <section className="sk test-card">
        <h3>{byButton(stage) ? '✅ Hoàn thành chặng' : '📝 Bài kiểm tra cuối chặng'}</h3>
        <p>Đăng nhập để {byButton(stage) ? 'đánh dấu hoàn thành' : 'làm bài kiểm tra'} và lưu tiến độ học của bạn.</p>
        <div className="row-btns"><button className="btn-p" type="button" onClick={() => setAuthOpen('login')}>Đăng nhập</button></div>
      </section>
    );
  }

  if (byButton(stage)) {
    const complete = async () => {
      try { setUser(await store.completeStage(stage.id)); await reload(); toast('Đã hoàn thành chặng “' + stage.key + '”.'); } catch (x) { toast(x.message, 'err'); }
    };
    return (
      <section className="sk test-card">
        <h3>✅ Hoàn thành chặng</h3>
        <p>{st.state === 'passed' ? 'Bạn đã hoàn thành chặng này.' + (next ? ' Chặng tiếp theo đã mở.' : '') : 'Học xong nội dung ở trên rồi bấm “Hoàn thành chặng” để mở chặng tiếp theo.'}</p>
        <div className="row-btns">{st.state !== 'passed' ? <button className="btn-p" type="button" onClick={complete}>Hoàn thành chặng</button> : nextBtn}</div>
      </section>
    );
  }
  if (!hasTest(stage)) {
    return (
      <section className="sk test-card">
        <h3>📝 Bài kiểm tra cuối chặng</h3>
        <p>Bài kiểm tra của chặng này đang được cập nhật. Bạn cần đạt bài kiểm tra để mở chặng tiếp theo — Mọt sẽ báo khi có bài.</p>
        {tier === 'staff' && <p className="note-box">Quản trị: vào CMS › Lộ trình học › Sửa chặng “{stage.key}” để soạn bài kiểm tra, hoặc đổi cách hoàn thành sang “Bấm nút”.</p>}
      </section>
    );
  }
  const qs = allQuestions(stage.test);
  const skills = [...new Set(stage.test.sections.map((x) => x.skill))];
  const last = subs && subs[0];
  if (taking) {
    return (
      <section className="sk test-card" id="kiem-tra">
        <h3>📝 Bài kiểm tra · {stage.key}</h3>
        <Exam stage={stage} onSubmit={async (ans) => { const r = await store.submitTest(stage.id, ans); if (r.user) setUser(r.user); await reload(); return r; }}
          onClose={() => { setTaking(false); store.mySubmissions(stage.id).then(setSubs, () => {}); }} />
      </section>
    );
  }
  return (
    <section className="sk test-card" id="kiem-tra">
      <h3>📝 Bài kiểm tra cuối chặng</h3>
      <div className="t-skills">{skills.map((k) => <span key={k} className="t-sk">{(SKILLS[k] || ['', '📝'])[1]} {(SKILLS[k] || ['Phần'])[0]}</span>)}</div>
      <p>{stage.test.sections.length} phần · {qs.length} câu · {qs.reduce((n, q) => n + qPoints(q), 0)} điểm{stage.test.minutes ? ' · ' + stage.test.minutes + ' phút' : ''} · cần đạt <b>{passPct(stage)}%</b> để mở chặng tiếp theo.{qs.some(isManual) ? ' Phần tự luận / nói do giáo viên chấm.' : ''}</p>
      <div className="t-stats">
        <span>Trạng thái: <b className={st.state === 'passed' ? 'ok' : ''}>{st.pending ? 'Đang chờ chấm' : st.state === 'passed' ? 'Đã đạt' : 'Chưa đạt'}</b></span>
        <span>Điểm cao nhất: <b>{st.best != null ? st.best + '%' : '—'}</b></span>
        <span>Số lần làm: <b>{st.attempts || 0}</b></span>
      </div>
      {last && last.status === 'graded' && last.feedback && <div className="t-feedback"><b>Nhận xét của giáo viên</b> ({last.pct}%): {last.feedback}</div>}
      <div className="row-btns">
        {st.pending ? <span className="pill-s warn">Bài gần nhất đang chờ chấm — chưa làm lại được</span>
          : <button className="btn-p" type="button" onClick={() => setTaking(true)}>{st.attempts ? 'Làm lại bài kiểm tra' : 'Bắt đầu làm bài'}</button>}
        {st.state === 'passed' && nextBtn}
      </div>
      {subs && subs.length > 0 && (
        <details className="dd"><summary>Lịch sử làm bài ({subs.length})</summary>
          <ol className="t-hist">{subs.map((x) => <li key={x.id}>{new Date(x.createdAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })} — {x.status === 'pending' ? '⏳ chờ chấm' : x.pct + '% ' + (x.passed ? '✓ đạt' : '✗ chưa đạt')}{x.feedback ? ' · ' + x.feedback : ''}</li>)}</ol>
        </details>
      )}
    </section>
  );
}

function StageDocs({ stage }) {
  const { content } = useApp();
  const { saved, toggleSave, download, locked } = useDocActions();
  const k = nrm((stage.keyword || '').trim());
  const docs = useMemo(() => (k ? content.documents.filter((d) => d.published !== false && nrm(d.name).includes(k)) : []), [content, k]);
  if (!docs.length) return null;
  const hot = hotSet(content.documents), maxDl = Math.max(1, ...content.documents.map((d) => d.downloads || 0));
  return (
    <section className="panel st-docs">
      <div className="head"><span>📚 Tài liệu cho chặng này <small>{docs.length} tài liệu</small></span></div>
      <div className="grid">{docs.slice(0, 8).map((d, i) => <DocCard onLocked={locked} key={d.id} doc={d} idx={'s' + i} hot={hot.has(d.id)} maxDl={maxDl} saved={saved.includes(d.id)} onSave={() => toggleSave(d.id)} onDownload={() => download(d.id)} />)}</div>
    </section>
  );
}

export default function StageDetail({ id }) {
  const { content, tier, progress, setProgress } = useApp();
  const states = useStageStates();
  const idx = content.stages.findIndex((s) => s.id === id);
  const s = content.stages[idx];
  if (s && !canEnterStage(s, tier)) return <UpgradeGate title={'Chặng “' + s.key + '” dành cho Học viên'} />;
  if (!s) return <section className="sk soon"><div className="soon-e">🔍</div><h2>Không tìm thấy chặng</h2><div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/lo-trinh')}>Về lộ trình</button></div></section>;
  const st = states[idx];
  const prev = content.stages[idx - 1], next = content.stages[idx + 1];
  if (st.state === 'locked') {
    return (
      <section className="sk soon">
        <div className="soon-e">🔒</div>
        <h2>Chặng “{s.key}” chưa mở</h2>
        <p>{byButton(prev) ? 'Hoàn thành chặng “' + prev.key + '” để mở chặng này.' : 'Vượt qua bài kiểm tra của chặng “' + prev.key + '” (đạt từ ' + passPct(prev) + '%) để mở chặng này.'}</p>
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
        <span className={'sd-state st-' + st.state}>{st.state === 'passed' ? '✓ Đã hoàn thành' : st.pending ? '⏳ Chờ chấm' : 'Đang học'}</span>
      </section>

      {((s.info || []).length > 0 || (s.sections || []).length > 0 || (s.boxes || []).length > 0) && (
        <section className="sk sd-body stage">
          {(s.info || []).length > 0 && <InfoBlock s={s} settings={content.settings} openLessons />}
          <Sections s={s} />
          <Boxes s={s} settings={content.settings} owned={owned} toggleOwned={toggleOwned} />
        </section>
      )}

      <StageDocs stage={s} />
      <TestCard key={s.id} stage={s} idx={idx} st={st} />

      <nav className="sd-pn">
        {prev ? <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh/' + prev.id)}>‹ {prev.key}</button> : <span />}
        {next && states[idx + 1].state !== 'locked' ? <button className="btn-s" type="button" onClick={() => navigate('/lo-trinh/' + next.id)}>{next.key} ›</button> : <span />}
      </nav>
    </div>
  );
}
