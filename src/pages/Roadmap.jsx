import { useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import MOUNTAIN from '../data/mountain.svg.js';
import { byButton, stageStates } from '../services/model.js';
import { Boxes, Chip, InfoBlock, Sections } from '../components/StageParts.jsx';

const PHASES = [['Bắt đầu', 'Chuẩn bị', '#7fc8a9'], ['Nhập môn', 'Pinyin', '#ecb857'], ['HSK 1–3', 'Sơ cấp', '#74b5e4'], ['HSK 4–6', 'Trung cấp', '#b86fa3'], ['HSK 7–9', 'Cao cấp', '#c0392b']];

function Hero({ learner }) {
  return (
    <div className="sk rhero">
      <div className="rh-l">
        <button className="back" type="button" onClick={() => navigate('/')}>‹ Trang chủ</button>
        <h2><mark>Lộ trình học tiếng Trung</mark><em>cho người mới</em></h2>
        <div className="phase">
          {PHASES.map((p, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <i>→</i>}<span className="ph" style={{ background: p[2], color: i === 4 ? '#fff' : undefined }}>{p[0]}<small>{p[1]}</small></span></span>)}
        </div>
        <p className="sub">{learner
          ? 'Mỗi chặng là một cấp bậc. Vượt qua bài kiểm tra cuối chặng để mở chặng tiếp theo, từ Vỡ lòng đến Bậc thầy.'
          : 'Mỗi chặng là một cấp bậc: học xong là lên bậc, từ Vỡ lòng đến Bậc thầy. Nâng cấp tài khoản Học viên để vào học và làm bài kiểm tra từng chặng.'}</p>
      </div>
      <div className="rh-r" dangerouslySetInnerHTML={{ __html: MOUNTAIN }} />
      <div className="stamp" aria-label="Chương trình HSK 3.0">HSK<b>3.0</b></div>
    </div>
  );
}

// ---------- Tài khoản thường / khách: chỉ xem khung, không có nút, không có link ----------
function LockedRoadmap() {
  const { content, setUpgradeOpen, user } = useApp();
  const { stages, settings } = content;
  const ask = () => setUpgradeOpen(true);
  return (
    <section className="rm rm-locked" aria-label="Lộ trình học tiếng Trung">
      <Hero learner={false} />
      <div className="sk up-cta">
        <span className="up-ic" aria-hidden="true">🔒</span>
        <div><b>Lộ trình chi tiết dành cho Học viên</b><span>{user ? 'Tài khoản của bạn là tài khoản thường.' : 'Bạn chưa đăng nhập.'} Nâng cấp để mở bài học, giáo trình, bài kiểm tra và theo dõi tiến độ cá nhân.</span></div>
        <button className="btn-p" type="button" onClick={() => navigate('/nang-cap')}>⭐ Nâng cấp tài khoản</button>
      </div>

      <div className="sk stairs" aria-label="Bậc thang cấp bậc">
        <div className="st-head"><b>🪜 Bậc thang lên đỉnh</b><span>9 cấp bậc từ người mới tới HSK 7–9</span></div>
        <div className="st-row" onClick={ask}>
          {stages.map((s, i) => (
            <div key={s.id} className={'step' + (i === stages.length - 1 ? ' top' : '')}
              style={{ '--c': s.color, '--h': 58 + i * 15 + 'px', '--i': i, color: s.whiteText ? '#fff' : undefined }}>
              <span className="se">{s.emoji}</span><span className="sn">{s.key}</span><span className="sb">Bậc {i + 1}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tl">
        {stages.map((s, i) => {
          const next = stages[i + 1];
          return (
            <div key={s.id} className={'row' + (i === 0 ? ' first' : '')} style={{ '--a': s.color, '--b': next ? next.color : '#f2c94c' }}>
              <div className="node" style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }}>
                <span className="ne">{s.emoji}</span><span className="nk">{s.key}</span>
              </div>
              <div className="sk stage stage-lock" onClick={ask}>
                <h3><span className="lvt">BẬC {i + 1}</span>{s.title}{!/cấp$/.test(s.badge) && s.badge && <span className="bd">{s.badge}</span>}<span className="lock-tag">🔒 Học viên</span></h3>
                <p>{s.desc}</p>
                <div className="chips">{(s.chips || []).map((c) => <Chip key={c} label={c} settings={settings} />)}</div>
              </div>
            </div>
          );
        })}
        <div className="row last">
          <div className="node" style={{ background: 'var(--panel)', fontSize: 22 }}>⚑</div>
          <div className="dest"><span><b>Đích đến: HSK 7–9</b> — đọc hiểu văn bản học thuật, báo chí chuyên sâu và giao tiếp thành thạo như người bản ngữ.</span></div>
        </div>
      </div>
    </section>
  );
}

// ---------- Học viên (và biên tập/quản trị xem trước) ----------
const STATE_LABEL = { passed: 'Đã hoàn thành', open: 'Đang học', locked: 'Chưa mở khoá', pending: 'Bài kiểm tra chờ chấm' };

export function useStageStates() {
  const { content, progress, tier } = useApp();
  const st = stageStates(content.stages, progress);
  // biên tập/quản trị: xem trước, không bị khoá
  return tier === 'staff' ? st.map((x) => (x.state === 'locked' ? { ...x, state: 'open' } : x)) : st;
}

function LearnerRoadmap() {
  const { content, progress, setProgress, setLibQuery, toast } = useApp();
  const { stages, settings } = content;
  const states = useStageStates();
  const rows = useRef({});
  const owned = progress.owned || [];
  const passedN = states.filter((x) => x.state === 'passed').length;
  const pct = stages.length ? Math.round((passedN / stages.length) * 100) : 0;
  const curIdx = Math.max(0, states.findIndex((x) => x.state === 'open'));
  const cur = stages[curIdx];
  const open = (s, i) => (states[i].state === 'locked' ? toast((byButton(stages[i - 1]) ? 'Hoàn thành chặng “' : 'Đạt bài kiểm tra chặng “') + stages[i - 1].key + '” để mở chặng này.', 'err') : navigate('/lo-trinh/' + s.id));
  const toggleOwned = (k) => setProgress({ owned: owned.includes(k) ? owned.filter((x) => x !== k) : [...owned, k] });
  const goLib = (keyword) => { setLibQuery(keyword || ' '); navigate('/'); };
  const jump = (id) => {
    const r = rows.current[id]; if (!r) return;
    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const c = r.querySelector('.stage'); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
  };

  return (
    <section className="rm" aria-label="Lộ trình học tiếng Trung">
      <Hero learner />

      <div className="sk stairs" aria-label="Bậc thang cấp bậc">
        <div className="st-head"><b>🪜 Bậc thang lên đỉnh</b><span>Bấm vào một bậc để nhảy tới chặng đó</span></div>
        <div className="st-row">
          {stages.map((s, i) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} className={'step' + (i === curIdx ? ' here' : '') + (i === stages.length - 1 ? ' top' : '') + (states[i].state === 'locked' ? ' st-lk' : '')}
              style={{ '--c': s.color, '--h': 58 + i * 15 + 'px', '--i': i, color: s.whiteText ? '#fff' : undefined }}>
              <span className="se">{states[i].state === 'locked' ? '🔒' : s.emoji}</span><span className="sn">{s.key}</span><span className="sb">Bậc {i + 1}{states[i].state === 'passed' ? ' ✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sk jr">
        <div><b>Lộ trình của bạn 🚩</b><div className="cur">Đang học: <b>{cur ? cur.key + ' · ' + cur.title : '—'}</b> · đã qua {passedN}/{stages.length} chặng</div></div>
        <button className="dk" type="button" onClick={() => cur && navigate('/lo-trinh/' + cur.id)}>Tiếp tục học ›</button>
        <div className="bwrap"><div className="bar"><i style={{ width: pct + '%' }} /></div><span className="pct">{pct}% toàn lộ trình</span></div>
        <div className="my-steps">
          {stages.map((s, i) => (
            <button key={s.id} type="button" className={'ms ms-' + states[i].state} onClick={() => open(s, i)} title={STATE_LABEL[states[i].state]}>
              <span>{states[i].state === 'passed' ? '✓' : states[i].state === 'locked' ? '🔒' : '▶'}</span>{s.key}
              {states[i].best != null && <small>{states[i].best}%</small>}
            </button>
          ))}
        </div>
      </div>

      <div className="tl">
        {stages.map((s, i) => {
          const stt = states[i], next = stages[i + 1], locked = stt.state === 'locked';
          return (
            <div key={s.id} ref={(el) => (rows.current[s.id] = el)} className={'row' + (i === 0 ? ' first' : '')} style={{ '--a': s.color, '--b': next ? next.color : '#f2c94c' }}>
              <div className={'node' + (i === curIdx ? ' cur' : '')} style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }}>
                <span className="ne">{locked ? '🔒' : s.emoji}</span><span className="nk">{s.key}</span>
              </div>
              <div className={'sk stage' + (locked ? ' stage-lock' : '')}>
                <h3><span className="lvt">BẬC {i + 1}</span>{s.title}{!/cấp$/.test(s.badge) && s.badge && <span className="bd">{s.badge}</span>}{locked && <span className="lock-tag">🔒 Chưa mở</span>}</h3>
                <p>{s.desc}</p>
                {!locked && (s.info || []).length > 0 && <InfoBlock s={s} settings={settings} />}
                {!locked && <Sections s={s} />}
                {!locked && (s.boxes || []).length > 0
                  ? <Boxes s={s} settings={settings} owned={owned} toggleOwned={toggleOwned} />
                  : <div className="chips">{(s.chips || []).map((c) => <Chip key={c} label={c} settings={settings} />)}</div>}
                <div className="sbar"><div className="bar" style={{ flex: 1 }}><i style={{ width: stt.state === 'passed' ? '100%' : stt.state === 'open' ? '40%' : 0 }} /></div>{STATE_LABEL[stt.pending && stt.state !== 'passed' ? 'pending' : stt.state]}{stt.best != null ? ' · điểm cao nhất ' + stt.best + '%' : ''}</div>
                {locked ? (
                  <div className="act"><span className="lock-note">{byButton(stages[i - 1]) ? 'Hoàn thành' : 'Qua bài kiểm tra'} “{stages[i - 1].key}” để mở</span></div>
                ) : (
                  <div className="act" style={{ gridRow: '1/span ' + ((s.sections || []).length || (s.info || []).length ? 5 : 4) }}>
                    <button className={'go' + (stt.state === 'open' ? ' on' : '')} type="button" onClick={() => open(s, i)}>{stt.state === 'passed' ? 'Ôn lại' : 'Vào học'}</button>
                    <button className="arr" type="button" aria-label={'Mở chặng ' + s.title} onClick={() => open(s, i)}>›</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="row">
          <div className="node" style={{ background: '#f2c94c' }}><span className="ne">🎓</span><span className="nk">Chứng chỉ</span></div>
          <div className="sk stage">
            <h3>Thi chứng chỉ HSK <span className="bd">Chứng chỉ</span></h3>
            <p>Thi thử và ôn đề theo từng cấp độ để sẵn sàng cho kỳ thi chứng chỉ HSK chính thức. Chọn cấp bạn muốn thi.</p>
            <div className="chips">
              {stages.filter((s) => /HSK/.test(s.title)).map((s) => (
                <button key={s.id} type="button" className="chip cert" style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }} onClick={() => goLib(s.keyword)}>{s.title.replace(' 3.0', '')}</button>
              ))}
            </div>
            <div className="act" style={{ gridRow: '1/span 3' }}><button className="arr" type="button" aria-label="Mở phần thi chứng chỉ HSK" onClick={() => goLib('HSK')}>›</button></div>
          </div>
        </div>
        <div className="row last">
          <div className="node" style={{ background: 'var(--panel)', fontSize: 22 }}>⚑</div>
          <div className="dest"><span><b>Đích đến: HSK 7–9</b> — đọc hiểu văn bản học thuật, báo chí chuyên sâu và giao tiếp thành thạo như người bản ngữ.</span></div>
        </div>
      </div>
    </section>
  );
}

export default function Roadmap() {
  const { tier } = useApp();
  return tier === 'student' || tier === 'staff' ? <LearnerRoadmap /> : <LockedRoadmap />;
}
