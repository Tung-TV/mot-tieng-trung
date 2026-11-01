// Các khối hiển thị của một chặng, dùng chung cho trang Lộ trình và trang Chi tiết chặng
import { useState } from 'react';
import { copyText, sanitizeHtml } from '../services/util.js';

export function Chip({ label, settings }) {
  const c = settings.chipColors?.[label], e = settings.chipEmojis?.[label];
  return <span className="chip" style={c ? { background: c } : undefined}>{e && <span className="cs" aria-hidden="true">{e}</span>}{label}</span>;
}

export function ToolsPanel({ settings, owned, toggleOwned }) {
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

export function AppsPanel({ settings }) {
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

export function InfoBlock({ s, settings }) {
  const u = (settings.affiliate || {})[s.affKey];
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
      {(s.lessons || []).length > 0 && (
        <details className="dd"><summary>📖 Danh sách {s.lessons.length} bài học trong giáo trình</summary>
          <div><ol className="ls15">{s.lessons.map((l, i) => <li key={i}><span className="bn">Bài {i + 1}</span><span className="lt"><b>{l[0]}</b><small>{l[1]}</small></span></li>)}</ol></div>
        </details>
      )}
    </div>
  );
}


export function Sections({ s }) {
  if (!s.sections || !s.sections.length) return null;
  return (
    <div className="secs">
      {s.sections.map((x, j) => (
        <div key={j} className="sec" style={{ '--c': x.color }}>
          <h4>{x.title}</h4>
          <ul>{x.items.map((l, k) => <li key={k}><span className="bn">{l[0]}</span>{l[1]}</li>)}</ul>
          {x.note && <div className="sn2">{x.note}</div>}
        </div>
      ))}
    </div>
  );
}

/** Hộp “Túi đồ nghề / App học” bấm để mở */
export function Boxes({ s, settings, owned, toggleOwned }) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  if (!s.boxes || !s.boxes.length || !settings.tools) return null;
  return (
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
  );
}
