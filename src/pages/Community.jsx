// Trang Cộng đồng: các kênh của Mọt, nhiệm vụ làm quen (bấm là mở link), lịch hoạt động trong tuần, quy tắc.
// Nội dung cấu hình ở CMS › Cài đặt › 👥 Cộng đồng.
import { useApp } from '../context/AppContext.jsx';
import { hrefOf } from '../router.jsx';
import { communityOf } from '../services/model.js';
import { useGiftState } from '../components/RoadmapGift.jsx';

const fmt = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'K' : String(n));

/** “@fbPage” → link kênh · “/luyen-go” → trang trong web · “https://…” → link ngoài */
export function resolveLink(link, platforms) {
  const v = String(link || '').trim();
  if (!v) return null;
  if (v.startsWith('@')) { const p = platforms.find((x) => x.k === v.slice(1)); return p && p.url ? { href: p.url, ext: true } : null; }
  if (v.startsWith('/')) return { href: hrefOf(v), ext: false };
  if (v.startsWith('#')) return { href: v, ext: false };
  return /^https?:\/\//i.test(v) ? { href: v, ext: true } : null;
}

export default function Community() {
  const { content, toast, user } = useApp();
  const c = communityOf(content.settings);
  const { gift, d, doneN, all, mark, share } = useGiftState();
  const total = c.platforms.reduce((n, p) => n + (Number(p.members) || 0), 0);
  const logo = (content.settings.images || {}).logo || 'assets/logo.jpg';
  const jump = (k) => { const t = document.getElementById('cd-' + k); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash'); } };
  return (
    <section className="cdm" aria-label="Cộng đồng học tiếng Trung">
      <div className="cd-hero">
        <span className="bd">HỆ SINH THÁI MỌT TIẾNG TRUNG</span>
        <h2>Học tiếng Trung <mark>không cô đơn</mark> 🐛</h2>
        <p>Mọt có mặt ở nhiều nơi để bạn học mọi lúc: xem mẹo trên TikTok, hỏi bài trong nhóm, điểm danh cùng bạn bè. Chọn nơi bạn thích, hoặc theo dõi tất cả!</p>
        <div className="cd-stage">
          <div className="cd-mas">
            <div className="cd-bub">Chào {user && user.name ? user.name.trim().split(/\s+/).pop() : 'bạn'}! 👋<br />Cùng học nhé!</div>
            <div className="cd-mid"><img src={logo} alt="Mọt Tiếng Trung" /></div>
            <div className="cd-tot"><small>TỔNG MỌTer</small><b>{total ? fmt(total) : 'Sắp cập nhật'}</b></div>
          </div>
          <div className="cd-st">{c.platforms.map((p, i) => (
            <button key={p.k} type="button" className="cd-sc" style={{ '--c': p.c, '--i': i }} onClick={() => jump(p.k)}>
              <span className="e">{p.e}</span><span className="t"><small>{p.n}</small><b>{p.members ? fmt(p.members) : 'Sắp cập nhật'}</b><em>MỌTer</em></span>
            </button>
          ))}</div>
        </div>
      </div>

      <h3 className="cd-sec">📍 Mọt đang ở đâu? <small>chọn nền tảng bạn dùng nhiều nhất</small></h3>
      <div className="cd-g">{c.platforms.map((p) => (
        <article key={p.k} className="cd-c" id={'cd-' + p.k} style={{ '--c': p.c }}>
          <div className="cd-ch"><span className="cd-ic" aria-hidden="true">{p.e}</span><div><b>{p.n}</b><span>{p.s}</span></div><span className="cd-mb">👥 {p.members ? fmt(p.members) + ' MỌTer' : 'MỌTer'}</span></div>
          <ul>{(p.ul || []).map((u, i) => <li key={i}>{u}</li>)}</ul>
          {p.h && <p className="hook">“{p.h}”</p>}
          {p.url ? <a className="cd-go" href={p.url} target="_blank" rel="noopener noreferrer" onClick={() => mark(p.k)}>{p.b || 'Mở ›'}</a>
            : <button type="button" className="cd-go off" onClick={() => toast('Mọt đang cập nhật link này, bạn quay lại sau nhé!')}>Link sắp có</button>}
        </article>
      ))}</div>

      <h3 className="cd-sec">🎯 Nhiệm vụ làm quen <small>bấm để mở kênh, mở xong là hoàn thành</small></h3>
      <div className="cd-q">
        <div className="cd-tk-w">
          <h3>Hành trình gia nhập Mọt</h3>
          <div className="cd-pg"><div className="bar"><i style={{ width: (all ? Math.round((doneN / all) * 100) : 0) + '%' }} /></div><span>{doneN}/{all}</span></div>
          {gift.active.map((t) => {
            const on = !!d.tasks[t.k], inner = <><span className="cd-ck" aria-hidden="true">{on ? '✓' : ''}</span><span className="cd-tl">{t.label}</span><span className="cd-ar">{on ? 'Đã xong' : t.k === 'share' ? 'Chia sẻ ›' : 'Mở ›'}</span></>;
            return t.k === 'share'
              ? <button key={t.k} type="button" className={'cd-tk' + (on ? ' on' : '')} onClick={share}>{inner}</button>
              : <a key={t.k} className={'cd-tk' + (on ? ' on' : '')} href={t.url} target="_blank" rel="noopener noreferrer" onClick={() => mark(t.k)}>{inner}</a>;
          })}
          {!all && <p className="muted">Mọt đang cập nhật nhiệm vụ.</p>}
          <div className={'cd-bdg' + (all && doneN === all ? ' on' : '')}><span className="em">{all && doneN === all ? '🏅' : '🔒'}</span>{all && doneN === all ? 'Huy hiệu “Mọt chính hiệu” đã mở khóa! Chụp màn hình khoe trong nhóm nhé.' : 'Hoàn thành ' + all + ' nhiệm vụ để mở khóa huy hiệu “Mọt chính hiệu”.'}</div>
        </div>
        <div className="cd-cal">
          <h3>📅 Lịch hoạt động trong tuần</h3>
          <table><tbody>{c.schedule.map((r, i) => {
            const l = resolveLink(r.link, c.platforms);
            return (
              <tr key={i}><td>{r.day}</td><td>{l ? <a className="cd-cl" href={l.href} {...(l.ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{r.text} <span aria-hidden="true">›</span></a> : r.text}</td></tr>
            );
          })}</tbody></table>
        </div>
        <div className="cd-rl"><h3>🤝 Quy tắc chung của Mọt</h3><ol>{c.rules.map((r, i) => <li key={i}>{r}</li>)}</ol></div>
      </div>

      <div className="cd-sh"><div><b>Rủ bạn cùng học nhé! 💛</b><p>Học nhóm vui hơn và dễ duy trì hơn. Chia sẻ Mọt cho một người bạn đang muốn học tiếng Trung.</p></div><button type="button" className="cd-bt" onClick={share}>🔗 Chia sẻ Mọt Tiếng Trung</button></div>
    </section>
  );
}
