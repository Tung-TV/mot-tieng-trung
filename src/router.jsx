// Router tối giản dựa trên hash (#/duong-dan) — chạy được trên mọi hosting tĩnh miễn phí
import { useEffect, useState } from 'react';

// Các trang luyện tập chuyển từ bản HTML gốc dùng hash kiểu cũ (#pinyin, #thi-hsk-1, #bai-hoc-1-3 …)
export const LEGACY = /^\/(on-tap|luyen-go|shadowing(-[kv]-\d+(-\d+)?)?|pinyin|bai-tap-pinyin|thi-hsk(-\d+)?|dia-diem-thi|hskk-so-cap|de-thi-\d+-\d+|lam-bai)$/;
export const isLegacy = (path) => LEGACY.test(path);

// Hỗ trợ cả link kiểu cũ của file gốc: #kho, #lo-trinh, #on-tap, #cong-dong
export function currentPath() {
  let h = (typeof location !== 'undefined' ? location.hash : '') || '';
  h = h.replace(/^#\/?/, '');
  const path = '/' + h.split('?')[0];
  return path === '/kho' ? '/' : path.replace(/\/$/, '') || '/';
}

/** Trang luyện tập luôn dùng hash kiểu cũ (#pinyin) để mã gốc nhận đúng trang */
export const hrefOf = (path) => (isLegacy(path) ? '#' + path.slice(1) : '#' + path);

export function navigate(path) {
  const target = hrefOf(path);
  if (location.hash !== target) location.hash = target;
}

function canon() {
  const h = location.hash;
  const m = /^#\/?bai-hoc-(\d+)-(\d+)$/.exec(h); // link bài học kiểu cũ
  if (m) { location.replace('#/bai-hoc/' + m[1] + '/' + m[2]); return true; }
  if (/^#\//.test(h) && isLegacy(currentPath())) { location.replace('#' + currentPath().slice(1)); return true; }
  return false;
}

export function useRoute() {
  const [path, setPath] = useState(() => { canon(); return currentPath(); });
  useEffect(() => {
    const on = () => { if (!canon()) setPath(currentPath()); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function Link({ to, children, ...rest }) {
  return <a href={hrefOf(to)} {...rest}>{children}</a>;
}
