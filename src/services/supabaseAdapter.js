// Backend dùng chung (tuỳ chọn): Supabase gói Free, gọi thẳng REST API — không cần cài SDK.
// Cần chạy docs/supabase.sql trên project Supabase trước, rồi đặt VITE_BACKEND=supabase,
// VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env
import { buildSeed } from './seed.js';

const SKEY = 'mot.sb.session';
const BACK = 'mot.sb.back'; // trang cần quay lại sau khi đăng nhập Google

export function createSupabaseAdapter(url, anonKey) {
  if (!url || !anonKey) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  let session = null;
  let authError = ''; // lỗi khi quay về từ Google, báo bằng toast
  try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch { session = null; }
  const saveSession = (s) => { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch { /* */ } };

  async function call(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
    if (auth && session && session.expires_at * 1000 < Date.now() + 30000) await refresh();
    const r = await fetch(url + path, {
      method,
      // apikey: khoá publishable (sb_publishable_…) hoặc anon cũ. Authorization chỉ gửi khi đã đăng nhập (JWT của người dùng).
      headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(auth && session ? { Authorization: 'Bearer ' + session.access_token } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    const data = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((data && (data.msg || data.message || data.error_description)) || 'Lỗi máy chủ (' + r.status + ')');
    return data;
  }
  async function refresh() {
    try {
      const s = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false });
      saveSession(s);
    } catch { saveSession(null); }
  }
  const rest = (p, o) => call('/rest/v1/' + p, o);
  const upsert = (table, row) => rest(table, { method: 'POST', body: row, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } });
  const toUser = (p) => p && ({ id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, createdAt: Date.parse(p.created_at), progress: p.progress || {}, avatar: p.avatar || '', providers: p.providers || [p.provider || 'email'] });
  const myProviders = () => (session && session.user && session.user.app_metadata && session.user.app_metadata.providers) || ['email'];

  // Supabase trả về sau khi đăng nhập Google: #access_token=...&refresh_token=...  hoặc  #error=...&error_description=...
  async function consumeOAuthRedirect() {
    const h = location.hash.replace(/^#/, '');
    if (!/(^|&)(access_token|error)=/.test(h)) return;
    const q = new URLSearchParams(h);
    let back = '#/'; try { back = sessionStorage.getItem(BACK) || '#/'; sessionStorage.removeItem(BACK); } catch { /* */ }
    history.replaceState(null, '', location.pathname + location.search + back);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    if (q.get('error')) throw new Error('Đăng nhập Google không thành công: ' + (q.get('error_description') || q.get('error')).replace(/\+/g, ' '));
    const tmp = { access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_at: Number(q.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(q.get('expires_in') || 3600) };
    saveSession(tmp);
    saveSession({ ...tmp, user: await call('/auth/v1/user') });
    const p = await myProfile();
    if (p && p.status !== 'active') { saveSession(null); throw new Error('Tài khoản đang bị khoá. Liên hệ quản trị viên.'); }
  }
  async function myProfile() {
    if (!session) return null;
    const rows = await rest('profiles?id=eq.' + session.user.id + '&select=*');
    const u = toUser(rows[0]);
    return u && { ...u, providers: myProviders(), hasPassword: myProviders().includes('email') };
  }

  // Bảng content còn trống mà đã sửa 1 mục → các mục mẫu khác sẽ biến mất. Nên ghi toàn bộ dữ liệu mẫu trước.
  let seeded = false;
  async function ensureSeeded(api) {
    if (seeded) return;
    const rows = await rest('content?select=id&limit=1');
    if (!rows.length) await api.importContent(buildSeed());
    seeded = true;
  }

  return {
    kind: 'supabase',
    googleMode: 'redirect', // bật Google trong Supabase › Authentication › Providers
    async loginWithGoogle() {
      try { sessionStorage.setItem(BACK, location.hash && !/access_token|error=/.test(location.hash) ? location.hash : '#/'); } catch { /* */ }
      location.assign(url + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(location.origin + location.pathname));
      return new Promise(() => {}); // trang sẽ chuyển sang Google
    },
    async init() {
      try { await consumeOAuthRedirect(); } catch (e) { authError = e.message; }
      const rows = await rest('content?select=id&limit=1');
      if (!rows.length) console.warn('[Mọt] Bảng content đang trống — đăng nhập admin rồi vào CMS › Sao lưu › "Khôi phục dữ liệu gốc".');
    },
    async getContent() {
      const rows = await rest('content?select=*&order=sort.asc');
      if (!rows.length) return buildSeed();
      const pick = (k) => rows.filter((r) => r.kind === k).map((r) => r.data);
      const settings = rows.find((r) => r.kind === 'settings');
      return { version: 1, documents: pick('document'), stages: pick('stage'), settings: settings ? settings.data : buildSeed().settings };
    },
    async saveDocument(doc) {
      await ensureSeeded(this);
      const d = { ...doc, id: doc.id || 'doc_' + crypto.randomUUID().slice(0, 8), createdAt: doc.createdAt || Date.now() };
      await upsert('content', { id: d.id, kind: 'document', sort: -d.createdAt, data: d }); return d;
    },
    async deleteDocument(id) { await ensureSeeded(this); await rest('content?id=eq.' + id, { method: 'DELETE' }); },
    async bumpDownload(id) { try { await rest('rpc/bump_download', { method: 'POST', body: { doc_id: id } }); } catch { /* bỏ qua */ } },
    async saveStage(stage) {
      await ensureSeeded(this);
      const s = { ...stage, id: stage.id || 'stage_' + crypto.randomUUID().slice(0, 8), order: stage.order ?? 999 };
      await upsert('content', { id: s.id, kind: 'stage', sort: s.order, data: s }); return s;
    },
    async deleteStage(id) { await ensureSeeded(this); await rest('content?id=eq.' + id, { method: 'DELETE' }); },
    async reorderStages(ids) {
      await ensureSeeded(this);
      const { stages } = await this.getContent();
      await Promise.all(stages.map((s) => upsert('content', { id: s.id, kind: 'stage', sort: ids.indexOf(s.id), data: { ...s, order: ids.indexOf(s.id) } })));
    },
    async saveSettings(settings) { await ensureSeeded(this); await upsert('content', { id: 'settings', kind: 'settings', sort: 0, data: settings }); },

    takeAuthError() { const e = authError; authError = ''; return e; },
    async currentUser() { return myProfile(); },
    async register({ name, email, password }) {
      const s = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data: { name } }, auth: false });
      if (!s.access_token) throw new Error('Đã tạo tài khoản. Hãy mở email để xác nhận rồi đăng nhập.');
      saveSession(s); return myProfile();
    },
    async login({ email, password }) {
      const s = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false });
      saveSession(s);
      const p = await myProfile();
      if (p && p.status !== 'active') { saveSession(null); throw new Error('Tài khoản đang bị khoá.'); }
      return p;
    },
    async logout() { try { await call('/auth/v1/logout', { method: 'POST' }); } catch { /* */ } saveSession(null); },
    async updateProgress(patch) {
      const p = await myProfile(); if (!p) return null;
      await rest('profiles?id=eq.' + p.id, { method: 'PATCH', body: { progress: { ...p.progress, ...patch } } });
      return myProfile();
    },
    async updateProfile({ name }) { const p = await myProfile(); await rest('profiles?id=eq.' + p.id, { method: 'PATCH', body: { name } }); return myProfile(); },
    async changePassword(oldPw, newPw) {
      if (myProviders().includes('email')) await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: session.user.email, password: oldPw }, auth: false });
      await call('/auth/v1/user', { method: 'PUT', body: { password: newPw } });
    },
    async listUsers() { return (await rest('profiles?select=*&order=created_at.asc')).map(toUser); },
    async createUser({ name, email, password, role }) {
      // đăng ký hộ — không lưu phiên trả về để admin không bị đăng xuất
      const s = await call('/auth/v1/signup', { method: 'POST', body: { email, password, data: { name } }, auth: false });
      const id = (s.user || s).id;
      if (role && role !== 'member') await rest('profiles?id=eq.' + id, { method: 'PATCH', body: { role } });
      return { id, name, email, role: role || 'member', status: 'active', createdAt: Date.now(), progress: {} };
    },
    async updateUser(id, patch) {
      if (patch.password) throw new Error('Supabase: người dùng tự đổi mật khẩu bằng chức năng “Quên mật khẩu”.');
      const body = {}; ['name', 'role', 'status'].forEach((k) => k in patch && (body[k] = patch[k]));
      await rest('profiles?id=eq.' + id, { method: 'PATCH', body });
      return toUser((await rest('profiles?id=eq.' + id + '&select=*'))[0]);
    },
    async deleteUser(id) { await rest('profiles?id=eq.' + id, { method: 'DELETE' }); },
    async exportContent() { return this.getContent(); },
    async importContent(json) {
      const rows = [
        ...json.documents.map((d) => ({ id: d.id, kind: 'document', sort: -(d.createdAt || 0), data: d })),
        ...json.stages.map((s, i) => ({ id: s.id, kind: 'stage', sort: i, data: { ...s, order: i } })),
        { id: 'settings', kind: 'settings', sort: 0, data: json.settings },
      ];
      await rest('content?id=neq.__none__', { method: 'DELETE' });
      await upsert('content', rows);
    },
    async resetContent() { await this.importContent(buildSeed()); },
  };
}
