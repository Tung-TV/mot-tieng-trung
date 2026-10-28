// Hỗ trợ "Đăng nhập bằng Google" cho chế độ lưu trên trình duyệt (Google Identity Services).
// Ở chế độ Supabase không cần file này: Supabase tự chuyển hướng sang Google (xem supabaseAdapter.js).

let gisPromise = null;

/** Tải script Google Identity Services một lần duy nhất */
export function loadGis() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Không có trình duyệt'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Không tải được Google Sign-In')));
      s.onerror = () => { gisPromise = null; reject(new Error('Không kết nối được tới Google. Kiểm tra mạng rồi thử lại.')); };
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

/** Giải mã phần payload của ID token (JWT) mà Google trả về */
export function decodeJwt(token) {
  const part = String(token || '').split('.')[1];
  if (!part) throw new Error('Phản hồi đăng nhập Google không hợp lệ.');
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Kiểm tra các trường cơ bản của ID token (chữ ký chỉ kiểm được ở máy chủ — xem PLAN.md) */
export function checkGoogleClaims(p, clientId) {
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(p.iss)) throw new Error('Token không do Google cấp.');
  if (p.aud !== clientId) throw new Error('Token Google không dành cho trang này.');
  if (!p.exp || p.exp * 1000 < Date.now()) throw new Error('Phiên đăng nhập Google đã hết hạn, thử lại nhé.');
  if (!p.email || p.email_verified === false) throw new Error('Email Google chưa được xác minh.');
  return p;
}
