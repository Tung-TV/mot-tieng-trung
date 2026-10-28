import { useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function BackupAdmin() {
  const { store, run, toast, ask } = useApp();
  const file = useRef(null);
  const exp = () => run(async () => { const j = await store.exportContent(); download('content.json', JSON.stringify(j, null, 1)); }, 'Đã tải content.json.');
  const imp = async (f) => {
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!(await ask({ title: 'Nhập dữ liệu', message: 'File này sẽ thay toàn bộ tài liệu, lộ trình và cài đặt hiện tại.', danger: true, ok: 'Nhập' }))) return;
      await run(() => store.importContent(j), 'Đã nhập dữ liệu.');
    } catch (e) { if (e instanceof SyntaxError) toast('File không phải JSON hợp lệ.', 'err'); }
    finally { if (file.current) file.current.value = ''; }
  };
  const reset = async () => (await ask({ title: 'Khôi phục nội dung gốc', message: 'Đưa về 40 tài liệu và 9 chặng ban đầu. Mọi chỉnh sửa sẽ mất.', danger: true, ok: 'Khôi phục' })) && run(() => store.resetContent(), 'Đã khôi phục nội dung gốc.');
  return (
    <>
      <h1 className="adm-h">Sao lưu &amp; xuất bản</h1>
      <div className="adm-cols">
        <section className="card">
          <h2>💾 Tải bản sao lưu</h2>
          <p>Tải toàn bộ nội dung (tài liệu, lộ trình, cài đặt) thành file <code>content.json</code>. Tài khoản người dùng không nằm trong file.</p>
          {store.kind === 'local' && <p className="muted">Xuất bản cho mọi người: chép file vào thư mục <code>public/</code> rồi build &amp; deploy lại. Trình duyệt của khách sẽ tự dùng bản mới hơn.</p>}
          <button type="button" className="btn-p" onClick={exp}>Tải content.json</button>
        </section>
        <section className="card">
          <h2>📥 Nhập từ file</h2>
          <p>Khôi phục từ một file <code>content.json</code> đã tải trước đó.</p>
          <input ref={file} type="file" accept="application/json,.json" onChange={(e) => imp(e.target.files[0])} />
        </section>
        <section className="card danger">
          <h2>♻️ Khôi phục nội dung gốc</h2>
          <p>Đưa tài liệu, lộ trình và cài đặt về như bản HTML ban đầu.</p>
          <button type="button" className="btn-d" onClick={reset}>Khôi phục</button>
        </section>
      </div>
    </>
  );
}
