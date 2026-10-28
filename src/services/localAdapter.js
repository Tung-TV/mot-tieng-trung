// Backend mặc định: lưu toàn bộ dữ liệu trong localStorage của trình duyệt (miễn phí, chạy offline)
import { buildSeed, uid } from './seed.js';
import { hashPassword, newSalt } from './crypto.js';
import { checkGoogleClaims, decodeJwt } from './google.js';

const K = { db: 'mot.db.v1', users: 'mot.users.v1', session: 'mot.session.v1' };
const mem = {}; // dự phòng khi localStorage bị chặn
const ls = {
  get(k) { try { const v = localStorage.getItem(k); return v == null ? mem[k] ?? null : v; } catch { return mem[k] ?? null; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
  del(k) { delete mem[k]; try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};
const read = (k, d) => { try { const v = ls.get(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => ls.set(k, JSON.stringify(v));

const publicUser = (u) => u && ({
  id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt, progress: u.progress || {},
  avatar: u.avatar || '', hasPassword: !!u.passHash, providers: [u.passHash && 'email', u.googleSub && 'google'].filter(Boolean),
});
const can = (u, need) => u && u.status === 'active' && (need === 'member' || u.role === 'admin' || (need === 'editor' && u.role === 'editor'));

export function createLocalAdapter({ googleClientId = '' } = {}) {
  let db = null;
  const users = () => read(K.users, []);
  const saveUsers = (list) => write(K.users, list);
  const me = () => { const id = read(K.session, null); return users().find((u) => u.id === id) || null; };
  const require = (need) => { const u = me(); if (!can(u, need)) throw new Error('Bạn không có quyền thực hiện thao tác này.'); return u; };
  const persist = () => write(K.db, db);

  async function makeUser({ name, email, password, role = 'member' }) {
    const salt = newSalt();
    return { id: uid('user'), name, email: email.toLowerCase().trim(), role, status: 'active', salt, passHash: await hashPassword(password, salt), createdAt: Date.now(), progress: {} };
  }

  return {
    kind: 'local',
    // 'gis' = nút Google do thư viện Google vẽ; null = chưa cấu hình VITE_GOOGLE_CLIENT_ID
    googleMode: googleClientId ? 'gis' : null,
    googleClientId,
    async init() {
      db = read(K.db, null);
      // public/content.json = nội dung admin đã "xuất bản". Dùng nó nếu mới hơn bản đang lưu trong trình duyệt.
      try {
        const r = await fetch('content.json', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          if (j && j.documents && j.stages && j.settings && (!db || (j.publishedAt || 0) > (db.publishedAt || 0))) db = j;
        }
      } catch { /* không có file — bỏ qua */ }
      if (!db) db = buildSeed();
      persist();
      if (!users().length) saveUsers([await makeUser({ name: 'Quản trị Mọt', email: 'admin@mot.vn', password: 'admin123', role: 'admin' })]);
    },
    async getContent() { return structuredClone(db); },

    // ---- Tài liệu
    async saveDocument(doc) {
      require('editor');
      const d = { ...doc, id: doc.id || uid('doc'), createdAt: doc.createdAt || Date.now() };
      const i = db.documents.findIndex((x) => x.id === d.id);
      if (i < 0) db.documents.unshift(d); else db.documents[i] = d;
      persist(); return d;
    },
    async deleteDocument(id) { require('editor'); db.documents = db.documents.filter((d) => d.id !== id); persist(); },
    async bumpDownload(id) { const d = db.documents.find((x) => x.id === id); if (d) { d.downloads = (d.downloads || 0) + 1; persist(); } },

    // ---- Lộ trình
    async saveStage(stage) {
      require('editor');
      const s = { ...stage, id: stage.id || uid('stage') };
      const i = db.stages.findIndex((x) => x.id === s.id);
      if (i < 0) { s.order = db.stages.length; db.stages.push(s); } else db.stages[i] = s;
      persist(); return s;
    },
    async deleteStage(id) { require('editor'); db.stages = db.stages.filter((s) => s.id !== id); db.stages.forEach((s, i) => (s.order = i)); persist(); },
    async reorderStages(ids) {
      require('editor');
      db.stages.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).forEach((s, i) => (s.order = i));
      persist();
    },

    // ---- Cài đặt
    async saveSettings(settings) { require('admin'); db.settings = settings; persist(); },

    // ---- Tài khoản & phiên
    async currentUser() { return publicUser(me()); },
    async register({ name, email, password }) {
      const list = users();
      if (list.some((u) => u.email === email.toLowerCase().trim())) throw new Error('Email này đã được đăng ký.');
      const u = await makeUser({ name, email, password });
      saveUsers([...list, u]); write(K.session, u.id); return publicUser(u);
    },
    async login({ email, password }) {
      const u = users().find((x) => x.email === email.toLowerCase().trim());
      if (u && !u.passHash) throw new Error('Tài khoản này đăng nhập bằng Google. Bấm “Tiếp tục với Google”.');
      if (!u || (await hashPassword(password, u.salt)) !== u.passHash) throw new Error('Sai email hoặc mật khẩu.');
      if (u.status !== 'active') throw new Error('Tài khoản đang bị khoá. Liên hệ quản trị viên.');
      write(K.session, u.id); return publicUser(u);
    },
    // credential = ID token Google trả về cho nút "Đăng nhập bằng Google"
    async loginWithGoogle(credential) {
      if (!googleClientId) throw new Error('Chưa cấu hình đăng nhập Google (VITE_GOOGLE_CLIENT_ID).');
      const g = checkGoogleClaims(decodeJwt(credential), googleClientId);
      const email = g.email.toLowerCase();
      const list = users();
      let u = list.find((x) => x.googleSub === g.sub) || list.find((x) => x.email === email);
      if (u) {
        if (u.status !== 'active') throw new Error('Tài khoản đang bị khoá. Liên hệ quản trị viên.');
        u = { ...u, googleSub: g.sub, avatar: g.picture || u.avatar || '', name: u.name || g.name || email };
        saveUsers(list.map((x) => (x.id === u.id ? u : x)));
      } else {
        u = { id: uid('user'), name: g.name || email.split('@')[0], email, role: 'member', status: 'active', googleSub: g.sub, avatar: g.picture || '', createdAt: Date.now(), progress: {} };
        saveUsers([...list, u]);
      }
      write(K.session, u.id); return publicUser(u);
    },
    async logout() { ls.del(K.session); },
    async updateProgress(patch) {
      const cur = me(); if (!cur) return null;
      const list = users().map((u) => (u.id === cur.id ? { ...u, progress: { ...(u.progress || {}), ...patch } } : u));
      saveUsers(list); return publicUser(list.find((u) => u.id === cur.id));
    },
    async updateProfile({ name }) {
      const cur = me(); if (!cur) throw new Error('Chưa đăng nhập.');
      saveUsers(users().map((u) => (u.id === cur.id ? { ...u, name } : u)));
      return publicUser({ ...cur, name });
    },
    async changePassword(oldPw, newPw) {
      const cur = me(); if (!cur) throw new Error('Chưa đăng nhập.');
      // tài khoản Google chưa có mật khẩu: cho đặt mật khẩu mới mà không cần mật khẩu cũ
      if (cur.passHash && (await hashPassword(oldPw, cur.salt)) !== cur.passHash) throw new Error('Mật khẩu hiện tại không đúng.');
      const salt = newSalt(), passHash = await hashPassword(newPw, salt);
      saveUsers(users().map((u) => (u.id === cur.id ? { ...u, salt, passHash } : u)));
    },

    // ---- Quản lý tài khoản (admin)
    async listUsers() { require('admin'); return users().map(publicUser); },
    async createUser(data) {
      require('admin');
      const list = users();
      if (list.some((u) => u.email === data.email.toLowerCase().trim())) throw new Error('Email này đã tồn tại.');
      const u = await makeUser(data); saveUsers([...list, u]); return publicUser(u);
    },
    async updateUser(id, patch) {
      const admin = require('admin');
      const list = users();
      const target = list.find((u) => u.id === id); if (!target) throw new Error('Không tìm thấy tài khoản.');
      const next = { ...target, ...('name' in patch ? { name: patch.name } : {}), ...('role' in patch ? { role: patch.role } : {}), ...('status' in patch ? { status: patch.status } : {}) };
      const admins = list.filter((u) => u.role === 'admin' && u.status === 'active' && u.id !== id).length;
      if (target.role === 'admin' && (next.role !== 'admin' || next.status !== 'active') && admins === 0) throw new Error('Phải còn ít nhất một quản trị viên đang hoạt động.');
      if (patch.password) { next.salt = newSalt(); next.passHash = await hashPassword(patch.password, next.salt); }
      saveUsers(list.map((u) => (u.id === id ? next : u)));
      if (id === admin.id && next.status !== 'active') ls.del(K.session);
      return publicUser(next);
    },
    async deleteUser(id) {
      const admin = require('admin');
      if (id === admin.id) throw new Error('Không thể xoá tài khoản đang đăng nhập.');
      saveUsers(users().filter((u) => u.id !== id));
    },

    // ---- Sao lưu
    async exportContent() { require('admin'); db.publishedAt = Date.now(); persist(); return structuredClone(db); },
    async importContent(json) {
      require('admin');
      if (!json || !Array.isArray(json.documents) || !Array.isArray(json.stages) || !json.settings) throw new Error('File không đúng định dạng sao lưu của Mọt.');
      db = json; persist();
    },
    async resetContent() { require('admin'); db = buildSeed(); persist(); },
  };
}
