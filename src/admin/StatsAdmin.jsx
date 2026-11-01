// CMS › Thống kê học tập: bao nhiêu người dùng, làm bao nhiêu bài, đúng bao nhiêu, đang kẹt ở đâu
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { GIFT_LEVELS, GIFT_SOURCES, allQuestions, giftOf, qPoints, stageLevel, stageStates, tierOf } from '../services/model.js';

const DAY = 86400000;
const lastAct = (u) => {
  const p = u.progress || {};
  const ts = [...Object.values(p.lessons || {}), ...Object.values(p.tests || {})].map((x) => x.at || 0);
  return Math.max(0, ...ts);
};
const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);

function Bars({ rows, unit = '' }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="st-bars">{rows.map(([l, v, sub]) => (
      <div key={l} className="st-bar"><span className="st-l">{l}</span><div className="st-t"><i style={{ width: Math.max(2, (v / max) * 100) + '%' }} /></div><b>{v}{unit}</b>{sub && <small>{sub}</small>}</div>
    ))}</div>
  );
}

export default function StatsAdmin() {
  const { store, content, toast } = useApp();
  const [users, setUsers] = useState(null);
  const [subs, setSubs] = useState(null);
  const [leads, setLeads] = useState(null);
  const [days, setDays] = useState(30);
  useEffect(() => {
    store.listUsers().then(setUsers, (e) => { toast(e.message, 'err'); setUsers([]); });
    store.listSubmissions().then(setSubs, () => setSubs([]));
    store.listLeads().then(setLeads, () => setLeads([]));
  }, [store, toast]);

  const S = useMemo(() => {
    if (!users || !subs) return null;
    const stages = content.stages, now = Date.now(), since = now - days * DAY;
    const learners = users.filter((u) => tierOf(u) !== 'staff');
    const tiers = { member: 0, student: 0, guest: 0 };
    learners.forEach((u) => { tiers[tierOf(u)] = (tiers[tierOf(u)] || 0) + 1; });
    const active = learners.filter((u) => lastAct(u) >= since);
    const started = learners.filter((u) => lastAct(u) > 0);
    // đang dừng ở chặng nào (chặng đầu tiên chưa hoàn thành)
    const at = stages.map(() => 0);
    started.forEach((u) => { const st = stageStates(stages, u.progress || {}); const i = st.findIndex((x) => x.state !== 'passed'); if (i >= 0) at[i] += 1; });
    const rs = subs.filter((x) => (x.createdAt || 0) >= since);
    const perStage = stages.map((s, i) => {
      const mine = rs.filter((x) => x.stageId === s.id), graded = mine.filter((x) => x.status === 'graded');
      return { s, at: at[i], attempts: mine.length, people: new Set(mine.map((x) => x.userId)).size, passed: graded.filter((x) => x.passed).length, graded: graded.length, pending: mine.filter((x) => x.status === 'pending').length, avg: graded.length ? Math.round(graded.reduce((n, x) => n + (x.pct || 0), 0) / graded.length) : null };
    });
    // câu hỏi khó: tỉ lệ làm đúng thấp nhất
    const qs = [];
    stages.forEach((s) => {
      if (!s.test) return;
      const mine = rs.filter((x) => x.stageId === s.id && x.items);
      allQuestions(s.test).forEach((q, k) => {
        const got = mine.filter((x) => x.items[q.id] !== undefined && x.items[q.id] !== null);
        if (!got.length) return;
        const right = got.filter((x) => Number(x.items[q.id]) >= qPoints(q)).length;
        qs.push({ s, k: k + 1, q, n: got.length, right, rate: pct(right, got.length) });
      });
    });
    qs.sort((a, b) => a.rate - b.rate || b.n - a.n);
    // bài học: số người bắt đầu / học xong, bài hay dừng
    const lessons = {};
    learners.forEach((u) => Object.entries((u.progress || {}).lessons || {}).forEach(([id, r]) => {
      const o = lessons[id] || (lessons[id] = { id, start: 0, done: 0, doing: 0 });
      o.start += 1; if (r.s === 'done') o.done += 1; else o.doing += 1;
    }));
    const name = (id) => { const [lv, n] = id.split('-').map(Number); const s = stages.find((x) => stageLevel(x) === lv); return 'HSK' + lv + ' · Bài ' + n + (s && s.lessons[n - 1] ? ' · ' + s.lessons[n - 1][0] : ''); };
    const ls = Object.values(lessons).map((x) => ({ ...x, name: name(x.id) }));
    const byLevel = [1, 2, 3, 4, 5, 6].map((lv) => { const m = ls.filter((x) => x.id.startsWith(lv + '-')); return ['HSK' + lv, m.reduce((n, x) => n + x.done, 0), m.reduce((n, x) => n + x.start, 0) + ' lượt bắt đầu']; });
    return { learners, tiers, active, started, perStage, qs: qs.slice(0, 12), stuckLessons: [...ls].sort((a, b) => b.doing - a.doing).filter((x) => x.doing).slice(0, 10), topLessons: [...ls].sort((a, b) => b.start - a.start).slice(0, 10), byLevel, rs, doneLessons: ls.reduce((n, x) => n + x.done, 0), gradedAll: rs.filter((x) => x.status === 'graded') };
  }, [users, subs, content, days]);

  const G = useMemo(() => {
    if (!leads) return null;
    const since = Date.now() - days * DAY, L = leads.filter((x) => (x.updatedAt || 0) >= since), gift = giftOf(content.settings);
    const count = (key, opts) => opts.map((o) => [o, L.filter((x) => (x.data || {})[key] === o).length]);
    return {
      L, gift, done: L.filter((x) => x.done).length,
      tasks: gift.tasks.map((t) => [t.label.length > 26 ? t.label.slice(0, 25) + '…' : t.label, L.filter((x) => ((x.data || {}).tasks || {})[t.k]).length]),
      src: count('s', GIFT_SOURCES), lv: count('l', GIFT_LEVELS),
    };
  }, [leads, days, content]);
  const csv = () => {
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows = [['Ngày', 'Tên', 'Zalo/Email', 'Trình độ', 'Mục tiêu', 'Thời gian/ngày', 'Biết Mọt qua', 'Nhiệm vụ đã làm', 'Hoàn thành'], ...G.L.map((x) => { const d = x.data || {}; return [new Date(x.createdAt).toLocaleString('vi-VN'), d.n, d.c, d.l, (d.g || []).join('; '), d.t, d.s, Object.keys(d.tasks || {}).length + '/' + G.gift.active.length, x.done ? 'Có' : 'Chưa']; })];
    const b = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'nhan-lo-trinh.csv'; a.click();
  };
  if (!S) return <p className="muted">Đang tải thống kê…</p>;
  return (
    <>
      <div className="adm-top">
        <h1 className="adm-h">Thống kê học tập</h1>
        <select value={days} onChange={(e) => setDays(+e.target.value)}><option value={7}>7 ngày qua</option><option value={30}>30 ngày qua</option><option value={90}>90 ngày qua</option><option value={3650}>Từ trước tới nay</option></select>
      </div>
      <div className="kpis">
        <div className="kpi"><small>Người dùng</small><b>{S.learners.length}</b><span>{S.tiers.student || 0} học viên · {S.tiers.member || 0} thường</span></div>
        <div className="kpi"><small>Đang hoạt động</small><b>{S.active.length}</b><span>có học / làm bài trong {days >= 3650 ? 'mọi thời gian' : days + ' ngày'}</span></div>
        <div className="kpi"><small>Đã bắt đầu học</small><b>{S.started.length}</b><span>{pct(S.started.length, S.learners.length)}% người dùng</span></div>
        <div className="kpi"><small>Lượt làm bài kiểm tra</small><b>{S.rs.length}</b><span>{new Set(S.rs.map((x) => x.userId)).size} người · đạt {pct(S.gradedAll.filter((x) => x.passed).length, S.gradedAll.length)}%</span></div>
        <div className="kpi"><small>Bài học đã học xong</small><b>{S.doneLessons}</b><span>tổng số lượt đánh dấu học xong</span></div>
        {G && <div className="kpi"><small>Nhận lộ trình</small><b>{G.L.length}</b><span>{G.done} người làm xong nhiệm vụ ({pct(G.done, G.L.length)}%)</span></div>}
      </div>

      <section className="card">
        <h2>🚧 Người học đang dừng ở chặng nào</h2>
        <p className="muted">Chặng đầu tiên mỗi người chưa hoàn thành. Cột dài = nhiều người đang kẹt.</p>
        <Bars rows={S.perStage.map((x) => [x.s.key, x.at, x.attempts ? 'đạt ' + pct(x.passed, x.graded) + '% · TB ' + (x.avg ?? '—') + '%' : 'chưa ai làm bài'])} unit=" người" />
      </section>

      <div className="adm-cols">
        <section className="card">
          <h2>📝 Bài kiểm tra từng chặng</h2>
          <div className="tbl-wrap"><table className="tbl-adm">
            <thead><tr><th>Chặng</th><th>Lượt làm</th><th>Người làm</th><th>Đạt</th><th>Điểm TB</th><th>Chờ chấm</th></tr></thead>
            <tbody>{S.perStage.map((x) => <tr key={x.s.id}><td><b>{x.s.key}</b><span className="url">{x.s.title}</span></td><td>{x.attempts}</td><td>{x.people}</td><td>{x.graded ? pct(x.passed, x.graded) + '%' : '—'}</td><td>{x.avg ?? '—'}{x.avg != null ? '%' : ''}</td><td>{x.pending || ''}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="card">
          <h2>❓ Câu hỏi làm sai nhiều nhất</h2>
          {S.qs.length ? <ol className="st-qs">{S.qs.map((x) => <li key={x.s.id + x.q.id}><span className={'st-rate ' + (x.rate < 40 ? 'bad' : x.rate < 70 ? 'mid' : 'ok')}>{x.rate}%</span><div><b>{x.s.key} · Câu {x.k}</b> {x.q.prompt}<small>{x.right}/{x.n} lượt đúng</small></div></li>)}</ol> : <p className="muted">Chưa có bài làm nào.</p>}
        </section>
      </div>

      <div className="adm-cols">
        <section className="card">
          <h2>📚 Bài học theo cấp</h2>
          <Bars rows={S.byLevel} unit=" xong" />
        </section>
        <section className="card">
          <h2>⏸ Bài học nhiều người đang học dở</h2>
          {S.stuckLessons.length ? <ol className="toplist">{S.stuckLessons.map((x) => <li key={x.id}><span lang="zh">{x.name}</span><b>{x.doing} người</b></li>)}</ol> : <p className="muted">Chưa có dữ liệu.</p>}
          <h2 style={{ marginTop: 14 }}>🔥 Bài học được mở nhiều nhất</h2>
          {S.topLessons.length ? <ol className="toplist">{S.topLessons.map((x) => <li key={x.id}><span lang="zh">{x.name}</span><b>{x.start} · xong {x.done}</b></li>)}</ol> : <p className="muted">Chưa có dữ liệu.</p>}
        </section>
      </div>
      {G && (
        <section className="card">
          <div className="adm-top"><h2>🎁 Nhận ngay lộ trình (khảo sát + nhiệm vụ)</h2>{G.L.length > 0 && <button type="button" className="btn-s small" onClick={csv}>⬇ Tải danh sách (.csv)</button>}</div>
          {G.L.length ? (
            <>
              <div className="adm-cols">
                <div><h3>Số người đã bấm từng nhiệm vụ</h3><Bars rows={G.tasks} unit=" người" /></div>
                <div><h3>Biết Mọt qua đâu</h3><Bars rows={G.src} unit=" người" /><h3>Trình độ</h3><Bars rows={G.lv} unit=" người" /></div>
              </div>
              <div className="tbl-wrap"><table className="tbl-adm">
                <thead><tr><th>Ngày</th><th>Tên</th><th>Zalo / Email</th><th>Trình độ · mục tiêu</th><th>Nhiệm vụ</th></tr></thead>
                <tbody>{G.L.slice(0, 50).map((x) => { const d = x.data || {}; return <tr key={x.id}><td className="muted">{new Date(x.createdAt).toLocaleDateString('vi-VN')}</td><td><b>{d.n}</b></td><td>{d.c}</td><td>{d.l}<span className="url">{(d.g || []).join(', ')} · {d.t} · {d.s}</span></td><td>{x.done ? <span className="pill-s on">Xong</span> : <span className="pill-s warn">{Object.keys(d.tasks || {}).length}/{G.gift.active.length}</span>}</td></tr>; })}</tbody>
              </table></div>
            </>
          ) : <p className="muted">Chưa có ai làm khảo sát trong khoảng thời gian này.</p>}
        </section>
      )}
    </>
  );
}
