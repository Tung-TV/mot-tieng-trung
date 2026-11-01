import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { FM } from '../components/docArt.js';
import { fmtN, isAdmin, ROLE_LABEL } from '../services/util.js';
import { CONTENT_REV, contentUpdate } from '../services/seed.js';

function ContentUpdate() {
  const { content, store, reload, toast, ask } = useApp();
  const [busy, setBusy] = useState(false);
  if ((content.settings.contentRev || 1) >= CONTENT_REV) return null;
  const u = contentUpdate(content);
  const apply = async () => {
    if (!(await ask({ title: 'Cập nhật nội dung', message: 'Áp dụng nội dung mới? Bài kiểm tra, cách hoàn thành chặng và tài liệu bạn đã sửa được giữ nguyên.', ok: 'Áp dụng' }))) return;
    setBusy(true);
    try {
      for (const st of u.stages) await store.saveStage(st);
      for (const d of u.documents) await store.saveDocument(d);
      await store.saveSettings(u.settings);
      await reload(); toast('Đã cập nhật nội dung mới.');
    } catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  return (
    <section className="note-box up-note">
      <b>🆕 Có bản cập nhật nội dung</b> — lộ trình HSK1–6 đủ danh sách bài học, khoá học trọn bộ 365K/năm, đặt chặng Bắt đầu / Nhập môn và bài 1 mỗi cấp miễn phí, kho tài liệu thêm {u.documents.length} tài liệu. Sau đó vào mục <a href="#/admin/bai-hoc">Bài học</a> › “Nhập dữ liệu” để đưa nội dung từng bài (thư mục data/lessons).
      <div className="muted">Sẽ cập nhật {u.stages.length} chặng{u.planChanged ? ', đổi gói Học viên thành 365.000đ / 12 tháng' : ''}. Bài kiểm tra và tài liệu đã sửa được giữ nguyên.</div>
      <button className="btn-p" type="button" disabled={busy} onClick={apply}>{busy ? 'Đang cập nhật…' : 'Áp dụng cập nhật'}</button>
    </section>
  );
}

export default function Dashboard() {
  const { content, user, store } = useApp();
  const [users, setUsers] = useState(null);
  const [ups, setUps] = useState(null);
  const [subs, setSubs] = useState(null);
  useEffect(() => { store.listSubmissions().then(setSubs).catch(() => setSubs(null)); }, [store]);
  useEffect(() => {
    if (!isAdmin(user)) return;
    store.listUsers().then(setUsers).catch(() => setUsers(null));
    store.listUpgrades().then(setUps).catch(() => setUps(null));
  }, [user, store]);
  const docs = content.documents;
  const total = docs.reduce((s, d) => s + (d.downloads || 0), 0);
  const top = [...docs].sort((a, b) => b.downloads - a.downloads).slice(0, 5);
  const byFmt = Object.keys(FM).map((f) => [f, docs.filter((d) => d.format === f).length]);
  const max = Math.max(1, ...byFmt.map((x) => x[1]));
  return (
    <>
      <h1 className="adm-h">Tổng quan</h1>
      {isAdmin(user) && <ContentUpdate />}
      <div className="kpis">
        <div className="kpi"><small>Tài liệu</small><b>{docs.length}</b><span>{docs.filter((d) => d.published === false).length} đang ẩn</span></div>
        <div className="kpi"><small>Tổng lượt tải</small><b>{fmtN(total)}</b><span>{total.toLocaleString('vi-VN')} lượt</span></div>
        <div className="kpi"><small>Chặng lộ trình</small><b>{content.stages.length}</b><span>{content.stages.reduce((s, x) => s + (x.lessons || []).length, 0)} bài học</span></div>
        {subs && <a className="kpi kpi-link" href="#/admin/cham-bai"><small>Bài chờ chấm</small><b>{subs.filter((x) => x.status === 'pending').length}</b><span>{subs.length} lượt làm bài · {subs.filter((x) => x.passed).length} lượt đạt</span></a>}
        {ups && <a className="kpi kpi-link" href="#/admin/nang-cap"><small>Chờ kích hoạt học viên</small><b>{ups.filter((r) => r.status === 'pending' || r.status === 'claimed').length}</b><span>{ups.filter((r) => r.status === 'claimed').length} đã báo chuyển khoản · {ups.filter((r) => r.status === 'paid').length} đã kích hoạt</span></a>}
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
