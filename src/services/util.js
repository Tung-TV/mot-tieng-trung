// Bỏ dấu tiếng Việt để tìm kiếm (giống hàm nrm của bản gốc)
export const nrm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
export const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : String(n || 0));
export const docKind = (url = '') => (url.includes('/folders/') ? '📁 Thư mục' : url.includes('/spreadsheets/') ? '📊 Google Sheet' : '📄 Tệp');
export const hasHan = (s) => /[一-鿿]/.test(s || '');

// Lọc HTML do biên tập viên nhập (nội dung hướng dẫn App) trước khi hiển thị
export function sanitizeHtml(html) {
  if (typeof document === 'undefined') return '';
  const t = document.createElement('template');
  t.innerHTML = String(html || '');
  t.content.querySelectorAll('script,iframe,object,embed,style,link,meta,base,form').forEach((n) => n.remove());
  t.content.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      if (n.startsWith('on') || ((n === 'href' || n === 'src' || n === 'xlink:href') && v.startsWith('javascript:'))) el.removeAttribute(a.name);
    });
    if (el.tagName === 'A' && el.getAttribute('target') === '_blank') el.setAttribute('rel', 'noopener noreferrer');
  });
  return t.innerHTML;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true; } catch { return false; }
  }
}

export const ROLE_LABEL = { admin: 'Quản trị', editor: 'Biên tập', member: 'Học viên' };
export const canEdit = (u) => !!u && u.status === 'active' && (u.role === 'admin' || u.role === 'editor');
export const isAdmin = (u) => !!u && u.status === 'active' && u.role === 'admin';
