import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { fmtVnd } from '../services/model.js';
import { nrm } from '../services/util.js';
import { Empty } from './ui.jsx';

const ST = { pending: ['Chờ chuyển khoản', 'off'], claimed: ['Đã báo chuyển', 'warn'], paid: ['Đã kích hoạt', 'on'], cancelled: ['Đã huỷ', 'mute'] };
const dt = (t) => (t ? new Date(t).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function UpgradesAdmin() {
  const { store, toast, ask } = useApp();
  const [list, setList] = useState(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState('open');
  const load = useCallback(() => store.listUpgrades().then(setList, (e) => toast(e.message, 'err')), [store, toast]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (list || []).filter((r) =>
    (f === 'all' || (f === 'open' ? r.status === 'pending' || r.status === 'claimed' : r.status === f))
    && (!q || nrm(r.code + ' ' + r.name + ' ' + r.email).includes(nrm(q)))), [list, q, f]);

  const confirm = async (r) => {
    if (!(await ask({ title: 'Xác nhận đã nhận tiền', message: `Bạn đã thấy giao dịch ${fmtVnd(r.amount)} với nội dung “${r.code}” trong tài khoản ngân hàng? Tài khoản ${r.email} sẽ được nâng lên Học viên${r.months ? ' ' + r.months + ' tháng' : ' (không thời hạn)'}.`, ok: 'Kích hoạt học viên' }))) return;
    try { await store.confirmUpgrade(r.id); toast('Đã kích hoạt Học viên cho ' + r.email + '.'); load(); } catch (e) { toast(e.message, 'err'); }
  };
  const cancel = async (r) => {
    if (!(await ask({ title: 'Huỷ yêu cầu', message: 'Huỷ yêu cầu ' + r.code + ' của ' + r.email + '?', danger: true, ok: 'Huỷ yêu cầu' }))) return;
    try { await store.cancelUpgrade(r.id); toast('Đã huỷ yêu cầu.'); load(); } catch (e) { toast(e.message, 'err'); }
  };

  if (!list) return <p className="muted">Đang tải…</p>;
  const nOpen = list.filter((r) => r.status === 'pending' || r.status === 'claimed').length;
  return (
    <>
      <div className="adm-top"><h1 className="adm-h">Nâng cấp học viên <small>{nOpen} đang chờ</small></h1><button className="btn-s" type="button" onClick={load}>Tải lại</button></div>
      <p className="note-box">Mở app ngân hàng, tìm giao dịch có <b>nội dung chứa mã</b> (VD: MOTXXXXXX) và <b>đúng số tiền</b>, rồi bấm “Xác nhận đã nhận tiền” ở dòng có mã đó. Tài khoản sẽ được nâng lên Học viên ngay.</p>
      <div className="adm-filter">
        <input type="search" placeholder="Tìm mã giao dịch, tên, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={f} onChange={(e) => setF(e.target.value)}>
          <option value="open">Đang chờ xử lý</option><option value="paid">Đã kích hoạt</option><option value="cancelled">Đã huỷ</option><option value="all">Tất cả</option>
        </select>
      </div>
      <div className="tbl-wrap">
        <table className="tbl-adm">
          <thead><tr><th>Mã giao dịch</th><th>Tài khoản</th><th>Số tiền</th><th>Tạo lúc</th><th>Trạng thái</th><th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td><b className="up-code">{r.code}</b></td>
                <td><b>{r.name}</b><span className="url">{r.email}</span></td>
                <td>{fmtVnd(r.amount)}<span className="url">{r.months ? r.months + ' tháng' : 'không thời hạn'}</span></td>
                <td className="muted">{dt(r.createdAt)}{r.claimedAt && <span className="url">báo chuyển: {dt(r.claimedAt)}</span>}{r.paidAt && <span className="url">kích hoạt: {dt(r.paidAt)}</span>}</td>
                <td><span className={'pill-s ' + ST[r.status][1]}>{ST[r.status][0]}</span></td>
                <td className="acts">
                  {(r.status === 'pending' || r.status === 'claimed') && <><button type="button" className="btn-p small" onClick={() => confirm(r)}>Xác nhận đã nhận tiền</button><button type="button" className="btn-d small" onClick={() => cancel(r)}>Huỷ</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <Empty>Không có yêu cầu nào.</Empty>}
      </div>
    </>
  );
}
