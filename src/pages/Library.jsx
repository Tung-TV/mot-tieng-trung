import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import DocCard, { FileIcon } from '../components/DocCard.jsx';
import DonateBox from '../components/DonateBox.jsx';
import { nrm } from '../services/util.js';
import { navigate } from '../router.jsx';

const TB = [['ALL', 'Tất cả'], ['PDF', 'PDF'], ['PPT', 'PPT'], ['SHEET', 'SHEET'], ['DOCX', 'DOCX']];
const PER = 12;

export function useDocActions() {
  const { store, user, progress, setProgress, setAuthOpen, toast, reload } = useApp();
  const saved = progress.saved || [];
  return {
    saved,
    toggleSave: (id) => {
      if (!user) { toast('Đăng nhập để lưu tài liệu vào Kho của tôi.', 'err'); setAuthOpen('login'); return; }
      setProgress({ saved: saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id] });
    },
    download: (id) => { store.bumpDownload(id).then(reload); },
  };
}

export function hotSet(docs) {
  return new Set([...docs].sort((a, b) => b.downloads - a.downloads).slice(0, 3).map((d) => d.id));
}

export default function Library() {
  const { content, libQuery, setLibQuery } = useApp();
  const docs = useMemo(() => content.documents.filter((d) => d.published !== false), [content]);
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState(libQuery || '');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);
  const { saved, toggleSave, download } = useDocActions();

  // nhận từ khoá khi bấm "Vào học" ở trang Lộ trình
  useEffect(() => {
    if (libQuery) {
      setQ(libQuery.trim()); setTab('ALL'); setPage(1); setLibQuery('');
      setTimeout(() => document.querySelector('.lib-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [libQuery, setLibQuery]);

  const hot = useMemo(() => hotSet(docs), [docs]);
  const maxDl = Math.max(1, ...docs.map((d) => d.downloads || 0));
  const list = useMemo(() => {
    const k = nrm(q.trim());
    const a = docs.filter((d) => (tab === 'ALL' || d.format === tab) && (!k || nrm(d.name).includes(k)));
    if (sort === 'dl') a.sort((x, y) => y.downloads - x.downloads);
    else a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
    return a;
  }, [docs, tab, q, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PER));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PER, cur * PER);
  const reset = () => { setTab('ALL'); setQ(''); setSort('new'); setPage(1); };

  return (
    <div id="v-kho">
      <section className="hero" id="hero-kho">
        <span className="tag">Kho tài liệu cùng Mọt</span>
        <h1>Khám phá tài liệu cùng <span>MỌT TIẾNG TRUNG</span></h1>
        <button className="btn" type="button" onClick={() => navigate('/kho-cua-toi')}>Kho của tôi</button>
        <div className="proof">Cùng 10.000+ bạn học khám phá tài liệu mỗi ngày!</div>
      </section>

      <div className="panel search">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Tìm kiếm tài liệu, môn học, giáo trình..." aria-label="Tìm kiếm" />
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sắp xếp"><option value="new">Mới nhất</option><option value="dl">Tải nhiều nhất</option></select>
        <button type="button" onClick={reset}>Đặt lại</button>
      </div>

      <div className="wrap lib-wrap">
        <DonateBox zoom={zoom} setZoom={setZoom} />
        <main className="panel">
          <div className="tabs" role="toolbar" aria-label="Lọc theo định dạng">
            {TB.map(([f, l]) => (
              <button key={f} type="button" className={'tab' + (tab === f ? ' on' : '')} onClick={() => { setTab(f); setPage(1); }}>
                {f === 'ALL' ? <span className="ti" aria-hidden="true">🗂️</span> : <FileIcon f={f} w={15} />}
                {l}<span className="ct">{f === 'ALL' ? docs.length : docs.filter((d) => d.format === f).length}</span>
              </button>
            ))}
          </div>
          <div className="head"><span>Tất cả tài liệu <small>{list.length} tài liệu</small></span><span>{cur}/{pages}</span></div>
          <div className="strip"><span className="heart" aria-hidden="true">❤️</span><div><b>Thấy tài liệu hữu ích?</b><span>Mời Mọt một ly cà phê để Mọt có thêm động lực chia sẻ nhiều tài liệu hơn.</span></div><button type="button" onClick={() => setZoom(true)}>☕ Ủng hộ Mọt</button></div>
          <div className="grid">
            {shown.length ? shown.map((d, k) => (
              <DocCard key={d.id} doc={d} idx={k} hot={hot.has(d.id)} maxDl={maxDl} saved={saved.includes(d.id)} onSave={() => toggleSave(d.id)} onDownload={() => download(d.id)} />
            )) : <p className="empty">Không tìm thấy tài liệu phù hợp. Thử từ khóa khác nhé!</p>}
          </div>
          <div className="pager">
            <button className="pg" type="button" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>← Trước</button>
            <span>Trang {cur} / {pages}</span>
            <button className="pg" type="button" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Sau →</button>
          </div>
        </main>
      </div>
    </div>
  );
}
