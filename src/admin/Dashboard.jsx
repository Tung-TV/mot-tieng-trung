import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { FM } from '../components/docArt.js';
import { fmtN, isAdmin, ROLE_LABEL } from '../services/util.js';

export default function Dashboard() {
  const { content, user, store } = useApp();
  const [users, setUsers] = useState(null);
  useEffect(() => { if (isAdmin(user)) store.listUsers().then(setUsers).catch(() => setUsers(null)); }, [user, store]);
  const docs = content.documents;
  const total = docs.reduce((s, d) => s + (d.downloads || 0), 0);
  const top = [...docs].sort((a, b) => b.downloads - a.downloads).slice(0, 5);
  const byFmt = Object.keys(FM).map((f) => [f, docs.filter((d) => d.format === f).length]);
  const max = Math.max(1, ...byFmt.map((x) => x[1]));
  return (
    <>
      <h1 className="adm-h">Tổng quan</h1>
      <div className="kpis">
        <div className="kpi"><small>Tài liệu</small><b>{docs.length}</b><span>{docs.filter((d) => d.published === false).length} đang ẩn</span></div>
        <div className="kpi"><small>Tổng lượt tải</small><b>{fmtN(total)}</b><span>{total.toLocaleString('vi-VN')} lượt</span></div>
        <div className="kpi"><small>Chặng lộ trình</small><b>{content.stages.length}</b><span>{content.stages.reduce((s, x) => s + x.lessons.length, 0)} bài học</span></div>
        {users && <div className="kpi"><small>Tài khoản</small><b>{users.length}</b><span>{Object.entries(ROLE_LABEL).map(([r, l]) => users.filter((u) => u.role === r).length + ' ' + l.toLowerCase()).join(' · ')}</span></div>}
      </div>
      <div className="adm-cols">
        <section className="card">
          <h2>Tài liệu tải nhiều nhất</h2>
          <ol className="toplist">{top.map((d) => <li key={d.id}><span>{d.name}</span><b>{fmtN(d.downloads)}</b></li>)}</ol>
        </section>
        <section className="card">
          <h2>Theo định dạng</h2>
          {byFmt.map(([f, n]) => (
            <div key={f} className="hbar"><span>{f}</span><div><i style={{ width: (n / max) * 100 + '%', background: FM[f].c }} /></div><b>{n}</b></div>
          ))}
        </section>
      </div>
      {store.kind === 'local' && (
        <p className="note-box">Bạn đang dùng chế độ <b>lưu trên trình duyệt</b>: thay đổi chỉ có trên máy này. Để mọi người cùng thấy, vào <a href="#/admin/sao-luu">Sao lưu</a> › “Tải content.json” rồi đặt vào thư mục <code>public/</code> khi deploy, hoặc bật Supabase (xem PLAN.md).</p>
      )}
    </>
  );
}
