import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import DocCard from '../components/DocCard.jsx';
import { useDocActions, hotSet } from './Library.jsx';
import { ROLE_LABEL } from '../services/util.js';

export default function MyLibrary() {
  const { user, content, setAuthOpen, store, setUser, toast, progress } = useApp();
  const { saved, toggleSave, download } = useDocActions();
  const [name, setName] = useState(user ? user.name : '');
  const [pw, setPw] = useState({ old: '', next: '' });

  if (!user) {
    return (
      <section className="sk soon">
        <div className="soon-e">📚</div>
        <h2>Kho của tôi</h2>
        <p>Đăng nhập để lưu tài liệu yêu thích và theo dõi tiến độ lộ trình trên mọi lần truy cập.</p>
        <div className="soon-a">
          <button className="btn-p" type="button" onClick={() => setAuthOpen('login')}>Đăng nhập</button>
          <button className="btn-s" type="button" onClick={() => setAuthOpen('register')}>Tạo tài khoản</button>
        </div>
      </section>
    );
  }
  const docs = content.documents.filter((d) => saved.includes(d.id));
  const hot = hotSet(content.documents);
  const maxDl = Math.max(1, ...content.documents.map((d) => d.downloads || 0));
  const curStage = content.stages.find((s) => s.id === progress.current);
  const doneN = (progress.done || []).length;

  const saveName = async (e) => { e.preventDefault(); try { setUser(await store.updateProfile({ name: name.trim() })); toast('Đã cập nhật tên.'); } catch (x) { toast(x.message, 'err'); } };
  const savePw = async (e) => {
    e.preventDefault();
    if (pw.next.length < 6) return toast('Mật khẩu mới tối thiểu 6 ký tự.', 'err');
    try {
      await store.changePassword(pw.old, pw.next); setPw({ old: '', next: '' });
      toast(user.hasPassword === false ? 'Đã tạo mật khẩu. Từ giờ bạn đăng nhập được bằng email hoặc Google.' : 'Đã đổi mật khẩu.');
      setUser(await store.currentUser());
    } catch (x) { toast(x.message, 'err'); }
  };

  return (
    <div className="mine">
      <section className="sk mine-h">
        <div>
          <h2>Kho của tôi</h2>
          <p>Xin chào <b>{user.name}</b> · {ROLE_LABEL[user.role]} · {user.email}{(user.providers || []).includes('google') && <span className="prov">Google</span>}</p>
          <p className="muted">Chặng hiện tại: <b>{curStage ? curStage.key + ' · ' + curStage.title : 'chưa chọn'}</b> · Đã hoàn thành {doneN}/{content.stages.length} chặng · Đã lưu {docs.length} tài liệu</p>
        </div>
        <a className="btn-s" href="#/lo-trinh">Tiếp tục lộ trình ›</a>
      </section>

      <main className="panel">
        <div className="head"><span>Tài liệu đã lưu <small>{docs.length} tài liệu</small></span></div>
        <div className="grid">
          {docs.length ? docs.map((d, k) => <DocCard key={d.id} doc={d} idx={k} hot={hot.has(d.id)} maxDl={maxDl} saved onSave={() => toggleSave(d.id)} onDownload={() => download(d.id)} />)
            : <p className="empty">Chưa có tài liệu nào. Bấm ♡ trên thẻ tài liệu ở <a href="#/">Kho tài liệu</a> để lưu lại.</p>}
        </div>
      </main>

      <section className="panel acc-form">
        <form className="form" onSubmit={saveName}>
          <b>Thông tin cá nhân</b>
          <label>Họ tên<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <button className="btn-p">Lưu</button>
        </form>
        <form className="form" onSubmit={savePw}>
          <b>{user.hasPassword === false ? 'Tạo mật khẩu' : 'Đổi mật khẩu'}</b>
          {user.hasPassword === false
            ? <p className="muted">Bạn đang đăng nhập bằng Google. Tạo thêm mật khẩu nếu muốn đăng nhập bằng email.</p>
            : <label>Mật khẩu hiện tại<input type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" required /></label>}
          <label>Mật khẩu mới<input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" required /></label>
          <button className="btn-p">{user.hasPassword === false ? 'Tạo mật khẩu' : 'Đổi mật khẩu'}</button>
        </form>
      </section>
    </div>
  );
}
