import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { copyText, sanitizeHtml } from '../services/util.js';
import MOUNTAIN from '../data/mountain.svg.js';

const PHASES = [['Bắt đầu', 'Chuẩn bị', '#7fc8a9'], ['Nhập môn', 'Pinyin', '#ecb857'], ['HSK 1–3', 'Sơ cấp', '#74b5e4'], ['HSK 4–6', 'Trung cấp', '#b86fa3'], ['HSK 7–9', 'Cao cấp', '#c0392b']];

function Chip({ label, settings }) {
  const c = settings.chipColors?.[label], e = settings.chipEmojis?.[label];
  return <span className="chip" style={c ? { background: c } : undefined}>{e && <span className="cs" aria-hidden="true">{e}</span>}{label}</span>;
}

function ToolsPanel({ settings, owned, toggleOwned }) {
  const n = settings.tools.filter((t) => owned.includes(t.k)).length;
  return (
    <div className="tools" role="region" aria-label="Túi đồ nghề của Mọt">
      <div className="th"><b>🎒 Túi đồ nghề của Mọt</b><span className="cnt">{n}/{settings.tools.length} đã sắm</span></div>
      <div className="tg">
        {settings.tools.map((x) => {
          const has = owned.includes(x.k), link = settings.affiliate[x.k];
          return (
            <article key={x.k} className="tc" style={{ '--c': x.c }}>
              <h4>{x.n}</h4>
              <div className="tim"><img src={x.img} alt={x.t} /></div>
              <p className="tn">{x.t}</p><p className="td">{x.d}</p>
              <div className="tb">
                <button type="button" className={'have' + (has ? ' on' : '')} aria-pressed={has} onClick={() => toggleOwned(x.k)}>{has ? '☑ Đã có' : '☐ Mình đã có'}</button>
                {link ? <a className="buy" href={link} target="_blank" rel="sponsored nofollow noopener">Mua ủng hộ Mọt ›</a> : <span className="buy off" title="Link đang được cập nhật">Link sắp có</span>}
              </div>
            </article>
          );
        })}
      </div>
      <p className="disc">Các nút “Mua ủng hộ Mọt” là link affiliate: nếu bạn mua qua đó, Mọt nhận một khoản hoa hồng nhỏ từ cửa hàng, còn giá bạn trả không đổi. Cảm ơn bạn đã ủng hộ để Mọt có thêm động lực chia sẻ nhiều tài liệu hơn!</p>
    </div>
  );
}

function AppsPanel({ settings }) {
  const [tab, setTab] = useState(0);
  const app = settings.apps[tab];
  // nút "Sao chép prompt" nằm trong HTML soạn sẵn → bắt sự kiện bằng uỷ quyền
  const onClick = async (e) => {
    const b = e.target.closest('button[data-copy]'); if (!b) return;
    const o = b.textContent; await copyText(settings.prompts[b.dataset.copy] || '');
    b.textContent = 'Đã sao chép'; setTimeout(() => (b.textContent = o), 1600);
  };
  if (!app) return null;
  return (
    <div className="tools apps" role="region" aria-label="App học tiếng Trung">
      <div className="th"><b>📱 App học cùng Mọt</b><span className="cnt">{settings.apps.length} app</span></div>
      <div className="atabs" role="tablist">
        {settings.apps.map((a, j) => <button key={j} type="button" role="tab" className="atab" aria-selected={j === tab} style={{ '--c': a.c }} onClick={() => setTab(j)}>{a.n}</button>)}
      </div>
      <div className="ag" role="tabpanel" onClick={onClick} dangerouslySetInnerHTML={{ __html: sanitizeHtml(app.h) }} />
    </div>
  );
}

function InfoBlock({ s, settings }) {
  const u = settings.affiliate[s.affKey];
  return (
    <div className="inf">
      {s.ribbon && <div className="ribbon" style={{ background: s.ribbonColor }}>{s.ribbon}</div>}
      <div className="ig">
        {s.info.map((r, k) => r[0] === 'Giáo trình' ? (
          <div key={k} className="ic ic-buy">
            {s.cover && <img className="cover" src={s.cover} alt={'Bìa giáo trình ' + s.title} />}
            <div className="bt"><b>{r[0]}</b><span>{r[1]}</span><small>Mua qua link này là ủng hộ Mọt. Mọt nhận hoa hồng nhỏ từ cửa hàng, giá bạn trả không đổi.</small></div>
            {u ? <a className="buyx" href={u} target="_blank" rel="sponsored nofollow noopener"><span className="bi">🛒</span>Mua giáo trình ngay<span className="ar">›</span></a>
              : <span className="buyx off"><span className="bi">🛒</span>Link mua sách sắp có</span>}
          </div>
        ) : <div key={k} className="ic"><b>{r[0]}</b><span>{r[1]}</span></div>)}
      </div>
      {s.lessons.length > 0 && (
        <details className="dd"><summary>📖 Danh sách {s.lessons.length} bài học trong giáo trình</summary>
          <div><ol className="ls15">{s.lessons.map((l, i) => <li key={i}><span className="bn">Bài {i + 1}</span><span className="lt"><b>{l[0]}</b><small>{l[1]}</small></span></li>)}</ol></div>
        </details>
      )}
    </div>
  );
}

export default function Roadmap() {
  const { content, progress, setProgress, setLibQuery } = useApp();
  const { stages, settings } = content;
  const [toolsOpen, setToolsOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const rows = useRef({});
  const curIdx = Math.max(0, stages.findIndex((s) => s.id === progress.current));
  const done = (progress.done || []).filter((id) => stages.some((s) => s.id === id));
  const owned = progress.owned || [];
  const pct = stages.length ? Math.round((done.length / stages.length) * 100) : 0;

  const goLib = (keyword) => { setLibQuery(keyword || ' '); navigate('/'); };
  const enter = (i) => { setProgress({ current: stages[i].id }); goLib(stages[i].keyword); };
  const toggleDone = (id) => setProgress({ done: done.includes(id) ? done.filter((x) => x !== id) : [...done, id] });
  const toggleOwned = (k) => setProgress({ owned: owned.includes(k) ? owned.filter((x) => x !== k) : [...owned, k] });
  const jump = (id) => {
    const r = rows.current[id]; if (!r) return;
    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const c = r.querySelector('.stage'); c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
  };
  const cur = stages[curIdx];

  return (
    <section className="rm" aria-label="Lộ trình học tiếng Trung">
      <div className="sk rhero">
        <div className="rh-l">
          <button className="back" type="button" onClick={() => navigate('/')}>‹ Trang chủ</button>
          <h2><mark>Lộ trình học tiếng Trung</mark><em>cho người mới</em></h2>
          <div className="phase">
            {PHASES.map((p, i) => <span key={i} style={{ display: 'contents' }}>{i > 0 && <i>→</i>}<span className="ph" style={{ background: p[2], color: i === 4 ? '#fff' : undefined }}>{p[0]}<small>{p[1]}</small></span></span>)}
          </div>
          <p className="sub">Mỗi chặng là một cấp bậc: học xong là lên bậc, từ Vỡ lòng đến Bậc thầy. Đã có nền tảng? Vào thẳng chặng bạn muốn, không cần học lại từ đầu.</p>
        </div>
        <div className="rh-r" dangerouslySetInnerHTML={{ __html: MOUNTAIN }} />
        <div className="stamp" aria-label="Chương trình HSK 3.0">HSK<b>3.0</b></div>
      </div>

      <div className="sk stairs" aria-label="Bậc thang cấp bậc">
        <div className="st-head"><b>🪜 Bậc thang lên đỉnh</b><span>Bấm vào một bậc để nhảy tới chặng đó</span></div>
        <div className="st-row">
          {stages.map((s, i) => (
            <button key={s.id} type="button" onClick={() => jump(s.id)} className={'step' + (i === curIdx ? ' here' : '') + (i === stages.length - 1 ? ' top' : '')}
              style={{ '--c': s.color, '--h': 58 + i * 15 + 'px', '--i': i, color: s.whiteText ? '#fff' : undefined }}>
              <span className="se">{s.emoji}</span><span className="sn">{s.key}</span><span className="sb">Bậc {i + 1}{done.includes(s.id) ? ' ✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sk jr">
        <div><b>Hành trình của bạn 🚩</b><div className="cur">Bạn đang ở: <b>{cur ? cur.key + ' · ' + cur.title : '—'}</b></div></div>
        <button className="dk" type="button" onClick={() => cur && goLib(cur.keyword)}>Tiếp tục học ›</button>
        <div className="bwrap"><div className="bar"><i style={{ width: pct + '%' }} /></div><span className="pct">{pct}% toàn lộ trình</span></div>
      </div>

      <div className="tl">
        {stages.map((s, i) => {
          const isCur = i === curIdx, isDone = done.includes(s.id);
          const next = stages[i + 1];
          return (
            <div key={s.id} ref={(el) => (rows.current[s.id] = el)} className={'row' + (i === 0 ? ' first' : '')} style={{ '--a': s.color, '--b': next ? next.color : '#f2c94c' }}>
              <div className={'node' + (isCur ? ' cur' : '')} style={{ background: s.color, color: s.whiteText ? '#fff' : undefined }}>
                <span className="ne">{s.emoji}</span><span className="nk">{s.key}</span>
              </div>
              <div className="sk stage">
                <h3><span className="lvt">BẬC {i + 1}</span>{s.title}{!/cấp$/.test(s.badge) && s.badge && <span className="bd">{s.badge}</span>}</h3>
                <p>{s.desc}</p>
                {s.info.length > 0 && <InfoBlock s={s} settings={settings} />}
                {s.sections.length > 0 && (
                  <div className="secs">
                    {s.sections.map((x, j) => (
                      <div key={j} className="sec" style={{ '--c': x.color }}>
                        <h4>{x.title}</h4>
                        <ul>{x.items.map((l, k) => <li key={k}><span className="bn">{l[0]}</span>{l[1]}</li>)}</ul>
                        {x.note && <div className="sn2">{x.note}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {s.boxes.length > 0 ? (
                  <>
                    <div className="two">
                      {s.boxes.map((x, j) => {
                        const op = x.tool ? toolsOpen : appsOpen;
                        return (
                          <button key={j} type="button" className="bx bxb" aria-expanded={op} title="Bấm để xem chi tiết" style={{ background: x.c }}
                            onClick={() => (x.tool ? setToolsOpen(!toolsOpen) : setAppsOpen(!appsOpen))}>
                            <span className="em" aria-hidden="true">{x.e}</span><span><b>{x.n}</b><small>{x.s}</small></span><span className="chev" aria-hidden="true">{op ? '▴' : '▾'}</span>
                          </button>
                        );
                      })}
                    </div>
                    {toolsOpen && <ToolsPanel settings={settings} owned={owned} toggleOwned={toggleOwned} />}
                    {appsOpen && <AppsPanel settings={settings} />}
                  </>
                ) : (
                  <div className="chips">{s.chips.map((c) => <Chip key={c} label={c} settings={settings} />)}</div>
                )}
                <div className="sbar"><div className="bar" style={{ flex: 1 }}><i style={{ width: isDone ? '100%' : isCur ? '40%' : 0 }} /></div>{isDone ? 'Đã hoàn thành' : isCur ? 'Đang học' : 'Chưa bắt đầu'}</div>
                <div className="act" style={{ gridRow: '1/span ' + (s.sections.length || s.info.length ? 5 : 4) }}>
                  <button className={'go' + (isCur ? ' on' : '')} type="button" onClick={() => enter(i)}>{isCur ? 'Đang học' : 'Vào học'}</button>
                  <button className={'go done-btn' + (isDone ? ' on' : '')} type="button" onClick={() => toggleDone(s.id)} aria-pressed={isDone}>{isDone ? '✓ Xong' : 'Đánh dấu xong'}</button>
                  <button className="arr" type="button" aria-label={'Mở tài liệu ' + s.title} onClick={() => enter(i)}>›</button>
                </div>
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
