import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal } from '../components/Overlays.jsx';
import { nrm, ROLE_LABEL } from '../services/util.js';
import { Field, Empty } from './ui.jsx';

function UserForm({ onSave, onClose }) {
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'member' });
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Modal title="Tạo tài khoản" onClose={onClose}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
        <Field label="Họ tên"><input value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
        <Field label="Mật khẩu (≥ 6 ký tự)"><input type="text" minLength={6} value={f.password} onChange={(e) => set('password', e.target.value)} required /></Field>
        <Field label="Vai trò"><select value={f.role} onChange={(e) => set('role', e.target.value)}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <div className="form-act"><button type="button" className="btn-s" onClick={onClose}>Huỷ</button><button className="btn-p">Tạo tài khoản</button></div>
      </form>
    </Modal>
  );
}

export default function UsersAdmin() {
  const { store, user, toast, auth, ask } = useApp();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => store.listUsers().then(setList, (e) => toast(e.message, 'err')), [store, toast]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, ok) => {
    try { await fn(); toast(ok); await load(); await auth.refreshUser(); return true; } catch (e) { toast(e.message || 'Có lỗi xảy ra', 'err'); return false; }
  };
  const shown = useMemo(() => (list || []).filter((u) => (role === 'ALL' || u.role === role) && (!q || nrm(u.name + ' ' + u.email).includes(nrm(q)))), [list, q, role]);

  const resetPw = async (u) => {
    const pw = await ask({ title: 'Đặt lại mật khẩu', message: 'Nhập mật khẩu mới cho ' + u.email + ', rồi gửi cho người dùng.', input: { label: 'Mật khẩu mới (ít nhất 6 ký tự)', minLength: 6 }, ok: 'Đặt mật khẩu' });
    if (pw == null) return;
    act(() => store.updateUser(u.id, { password: pw }), 'Đã đặt lại mật khẩu.');
  };
  const del = async (u) => (await ask({ title: 'Xoá tài khoản', message: 'Xoá ' + u.email + '? Tiến độ học của tài khoản này sẽ mất.', danger: true, ok: 'Xoá' })) && act(() => store.deleteUser(u.id), 'Đã xoá tài khoản.');

  if (!list) return <p className="muted">Đang tải danh sách…</p>;
  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Tài khoản <small>{list.length}</small></h1>{store.kind === 'local' && <button className="btn-p" type="button" onClick={() => setCreating(true)}>+ Tạo tài khoản</button>}</div>
      <div className="adm-filter">
        <input type="search" placeholder="Tìm theo tên hoặc email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}><option value="ALL">Mọi vai trò</option>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <div className="tbl-wrap">
        <table className="tbl-adm">
          <thead><tr><th>Tài khoản</th><th>Vai trò</th><th>Tiến độ</th><th>Ngày tạo</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {shown.map((u) => {
              const me = u.id === user.id, p = u.progress || {};
              return (
                <tr key={u.id}>
                  <td><b>{u.name}{me && ' (bạn)'}</b><span className="url">{u.email}{(u.providers || []).includes('google') && <span className="prov">Google</span>}</span></td>
                  <td><select value={u.role} onChange={(e) => act(() => store.updateUser(u.id, { role: e.target.value }), 'Đã đổi vai trò.')}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                  <td className="muted">{(p.done || []).length} chặng xong · {(p.saved || []).length} tài liệu lưu</td>
                  <td className="muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}</td>
                  <td><button type="button" className={'pill-s ' + (u.status === 'active' ? 'on' : 'off')} disabled={me} onClick={() => act(() => store.updateUser(u.id, { status: u.status === 'active' ? 'locked' : 'active' }), u.status === 'active' ? 'Đã khoá tài khoản.' : 'Đã mở khoá.')}>{u.status === 'active' ? 'Hoạt động' : 'Đã khoá'}</button></td>
                  <td className="acts">
                    {store.kind === 'local' && <button type="button" className="btn-s small" onClick={() => resetPw(u)}>Đặt lại MK</button>}
                    {!me && <button type="button" className="btn-d small" onClick={() => del(u)}>Xoá</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length && <Empty>Không có tài khoản phù hợp.</Empty>}
      </div>
      {store.kind !== 'local' && <p className="note-box">Với Supabase, người dùng tự đăng ký; đặt lại mật khẩu qua email trong Supabase Dashboard › Authentication.</p>}
      {creating && <UserForm onClose={() => setCreating(false)} onSave={async (f) => { if (await act(() => store.createUser(f), 'Đã tạo tài khoản.')) setCreating(false); }} />}
    </>
  );
}
