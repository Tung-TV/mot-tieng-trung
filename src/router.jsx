// Router tối giản dựa trên hash (#/duong-dan) — chạy được trên mọi hosting tĩnh miễn phí
import { useEffect, useState } from 'react';

// Hỗ trợ cả link kiểu cũ của file gốc: #kho, #lo-trinh, #on-tap, #cong-dong
export function currentPath() {
  let h = (typeof location !== 'undefined' ? location.hash : '') || '';
  h = h.replace(/^#\/?/, '');
  const path = '/' + h.split('?')[0];
  return path === '/kho' ? '/' : path.replace(/\/$/, '') || '/';
}

export function navigate(path) {
  const target = '#' + path;
  if (location.hash !== target) location.hash = target;
}

export function useRoute() {
  const [path, setPath] = useState(currentPath());
  useEffect(() => {
    const on = () => { setPath(currentPath()); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path;
}

export function Link({ to, children, ...rest }) {
  return <a href={'#' + to} {...rest}>{children}</a>;
}
