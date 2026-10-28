// Băm mật khẩu cho bản local. (Bản Supabase dùng Auth của Supabase, không qua đây.)
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256(text) {
  if (globalThis.crypto && crypto.subtle) {
    return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  }
  // dự phòng (môi trường không có SubtleCrypto): FNV-1a lặp — chỉ dùng cho demo
  let h = 0x811c9dc5, out = '';
  for (let r = 0; r < 8; r++) {
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i) + r; h = Math.imul(h, 0x01000193) >>> 0; }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

export const newSalt = () => Math.random().toString(36).slice(2, 12);
export const hashPassword = (password, salt) => sha256(salt + ':' + password);
