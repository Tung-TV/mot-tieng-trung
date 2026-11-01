// Backend mặc định: lưu toàn bộ dữ liệu trong localStorage của trình duyệt (miễn phí, chạy offline)
import { CONTENT_REV, buildSeed, contentUpdate, uid } from './seed.js';
import { hashPassword, newSalt } from './crypto.js';
import { checkGoogleClaims, decodeJwt } from './google.js';
import { DEFAULT_SUPPORT, DEFAULT_PLAN, allQuestions, byButton, gradeAuto, hasTest, isManual, newTxnCode, normTest, passPct, pctOf, qPoints, stageStates, testFromLessons, tierOf, viewFor, canEnterStage, canOpenLesson, stageLevel } from './model.js';

const K = { db: 'mot.db.v1', users: 'mot.users.v1', session: 'mot.session.v1', upgrades: 'mot.upgrades.v1', subs: 'mot.subs.v1', lessons: 'mot.lessons.v1', leads: 'mot.leads.v1' };
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
  avatar: u.avatar || '', hasPassword: !!u.passHash, studentUntil: u.studentUntil || null, providers: [u.passHash && 'email', u.googleSub && 'google'].filter(Boolean),
});
const can = (u, need) => {
  const t = tierOf(u && { ...u, studentUntil: u.studentUntil || null });
  if (t === 'guest') return false;
  if (need === 'member') return true;
  if (need === 'student') return t === 'student' || t === 'staff';
  return u.role === 'admin' || (need === 'editor' && u.role === 'editor');
};
// Bản lưu trên trình duyệt từ phiên bản trước: bổ sung gói học viên + bài kiểm tra mẫu
function upgradeDb(db) {
  if ((db.settings.contentRev || 1) < CONTENT_REV) {
    const u = contentUpdate(db);
    u.stages.forEach((st) => { const i = db.stages.findIndex((x) => x.id === st.id); if (i < 0) db.stages.push(st); else db.stages[i] = st; });
    db.documents = [...db.documents.map((d) => u.docsChanged.find((x) => x.id === d.id) || d), ...u.documents];
    db.settings = u.settings;
  }
  if (!db.settings.plan) db.settings.plan = { ...DEFAULT_PLAN };
  if (!db.settings.support) db.settings.support = { ...DEFAULT_SUPPORT };
  if (!db.settings.bank.bankId) db.settings.bank.bankId = 'MB';
  db.stages.forEach((s) => {
    if (s.test === undefined) s.test = testFromLessons(s.lessons || []);
    s.test = normTest(s.test);
    if (!s.completion) s.completion = s.key === 'Nhập môn' ? 'button' : 'test';
  });
  return db;
}

export function createLocalAdapter({ googleClientId = '' } = {}) {
  let db = null;
  const users = () => read(K.users, []);
  const saveUsers = (list) => write(K.users, list);
  const me = () => { const id = read(K.session, null); return users().find((u) => u.id === id) || null; };
  const require = (need) => { const u = me(); if (!can(u, need)) throw new Error('Bạn không có quyền thực hiện thao tác này.'); return u; };
  const persist = () => write(K.db, db);
  const lessonCache = {};
  async function levelLessons(level) {
    const lv = Number(level);
    if (!lessonCache[lv]) {
      try { const r = await fetch('data/lessons/' + lv + '.json'); lessonCache[lv] = r.ok ? await r.json() : []; } catch { lessonCache[lv] = []; }
    }
    const ov = read(K.lessons, {});
    const base = lessonCache[lv].map((l) => ov[l.id] || l);
    const extra = Object.values(ov).filter((l) => l.level === lv && !base.some((x) => x.id === l.id));
    return [...base, ...extra].sort((a, b) => a.n - b.n);
  }
  // danh sách bài trong chặng (tên bài + bài miễn phí) đi theo nội dung bài học
  function syncStageLessons(l) {
    const s = db.stages.find((x) => stageLevel(x) === l.level); if (!s) return;
    const lessons = [...(s.lessons || [])]; lessons[l.n - 1] = [l.title, l.vi || ''];
    const free = new Set(s.freeLessons || []); if (l.free) free.add(l.n); else free.delete(l.n);
    Object.assign(s, { lessons: Array.from(lessons, (x) => x || ['', '']), freeLessons: [...free].sort((a, b) => a - b) });
  }

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
      db = db ? upgradeDb(db) : buildSeed();
      persist();
      if (!users().length) saveUsers([await makeUser({ name: 'Quản trị Mọt', email: 'admin@mot.vn', password: 'admin123', role: 'admin' })]);
    },
    // mỗi loại tài khoản chỉ nhận phần dữ liệu được phép xem
    async getContent() { return viewFor(db, tierOf(publicUser(me()))); },

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

    // ---- Bài học của Khoá học (dữ liệu gốc ở data/lessons/<cấp>.json, phần admin sửa lưu đè trong trình duyệt)
    async getLesson(level, n) {
      const s = db.stages.find((x) => stageLevel(x) === Number(level));
      if (!canOpenLesson(s, n, tierOf(publicUser(me())))) throw new Error('Bài học dành cho Học viên Khoá học Mọt Tiếng Trung.');
      const l = (await levelLessons(level)).find((x) => x.n === Number(n));
      if (!l) throw new Error('Bài học này chưa có nội dung.');
      return l;
    },
    // ---- Quà nhận lộ trình: ai cũng ghi được bản khảo sát của mình; chỉ admin xem danh sách
    async saveLead(id, data) {
      const u = me();
      const all = read(K.leads, {}), old = all[id];
      all[id] = { id, userId: (old && old.userId) || (u && u.id) || null, data, done: !!data.done, createdAt: (old && old.createdAt) || Date.now(), updatedAt: Date.now() };
      write(K.leads, all);
    },
    async listLeads() { require('admin'); return Object.values(read(K.leads, {})).sort((a, b) => b.updatedAt - a.updatedAt); },
    async listLessons(level) { require('editor'); return levelLessons(level); },
    async saveLesson(lesson) {
      require('editor');
      write(K.lessons, { ...read(K.lessons, {}), [lesson.id]: { ...lesson, updatedAt: Date.now() } });
      syncStageLessons(lesson); persist(); return lesson;
    },
    async importLessons(list) {
      require('editor');
      const ov = read(K.lessons, {});
      list.forEach((l) => { ov[l.id] = { ...l, updatedAt: Date.now() }; syncStageLessons(l); });
      write(K.lessons, ov); persist(); return list.length;
    },

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
      const next = { ...target, ...('name' in patch ? { name: patch.name } : {}), ...('role' in patch ? { role: patch.role } : {}), ...('status' in patch ? { status: patch.status } : {}), ...('studentUntil' in patch ? { studentUntil: patch.studentUntil } : {}) };
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

    // ---- Học tập: nộp bài, chấm tự động, phần tự luận / nói chờ chấm tay
    async submitTest(stageId, answers) {
      const u = require('member');
      const i = db.stages.findIndex((s) => s.id === stageId);
      const s = db.stages[i]; if (!s || !hasTest(s)) throw new Error('Chặng này chưa có bài kiểm tra.');
      if (!canEnterStage(s, tierOf(publicUser(u)))) throw new Error('Chặng này dành cho Học viên.');
      if (tierOf(publicUser(u)) !== 'staff' && stageStates(db.stages, u.progress || {})[i].state === 'locked') throw new Error('Bạn cần hoàn thành chặng trước để mở chặng này.');
      const prev = (u.progress && u.progress.tests && u.progress.tests[stageId]) || {};
      if (prev.pending) throw new Error('Bài trước của bạn đang chờ chấm, chưa nộp lại được.');
      const g = gradeAuto(s.test, answers);
      const pending = g.manual > 0;
      const sub = { id: uid('sub'), userId: u.id, name: u.name, email: u.email, stageId, stageKey: s.key, answers, items: g.items, auto: g.earned, total: g.total, manualTotal: g.manual, status: pending ? 'pending' : 'graded', createdAt: Date.now() };
      if (!pending) { sub.pct = pctOf(g.earned, g.total); sub.passed = sub.pct >= passPct(s); }
      write(K.subs, [...read(K.subs, []), sub]);
      const rec = pending
        ? { ...prev, pending: true, attempts: (prev.attempts || 0) + 1, at: Date.now(), lastSub: sub.id }
        : { ...prev, pending: false, best: Math.max(prev.best || 0, sub.pct), last: sub.pct, passed: !!prev.passed || sub.passed, attempts: (prev.attempts || 0) + 1, at: Date.now(), lastSub: sub.id };
      const list = users().map((x) => (x.id === u.id ? { ...x, progress: { ...(x.progress || {}), tests: { ...((x.progress || {}).tests || {}), [stageId]: rec } } } : x));
      saveUsers(list);
      return { status: sub.status, earned: g.earned, total: g.total, manual: g.manual, pct: sub.pct ?? null, passed: sub.passed ?? false, items: g.items, user: publicUser(list.find((x) => x.id === u.id)) };
    },
    async completeStage(stageId) {
      const u = require('member');
      const i = db.stages.findIndex((s) => s.id === stageId);
      if (i >= 0 && !canEnterStage(db.stages[i], tierOf(publicUser(u)))) throw new Error('Chặng này dành cho Học viên.');
      if (i < 0 || !byButton(db.stages[i])) throw new Error('Chặng này cần làm bài kiểm tra để hoàn thành.');
      if (tierOf(publicUser(u)) !== 'staff' && stageStates(db.stages, u.progress || {})[i].state === 'locked') throw new Error('Bạn cần hoàn thành chặng trước.');
      const done = [...new Set([...((u.progress || {}).done || []), stageId])];
      const list = users().map((x) => (x.id === u.id ? { ...x, progress: { ...(x.progress || {}), done } } : x));
      saveUsers(list); return publicUser(list.find((x) => x.id === u.id));
    },
    async mySubmissions(stageId) {
      const u = require('member');
      return read(K.subs, []).filter((x) => x.userId === u.id && (!stageId || x.stageId === stageId)).sort((a, b) => b.createdAt - a.createdAt);
    },
    async listSubmissions() { require('editor'); return read(K.subs, []).sort((a, b) => b.createdAt - a.createdAt); },
    async gradeSubmission(id, manual, feedback) {
      const grader = require('editor');
      const all = read(K.subs, []);
      const sub = all.find((x) => x.id === id); if (!sub) throw new Error('Không tìm thấy bài làm.');
      const s = db.stages.find((x) => x.id === sub.stageId); if (!s) throw new Error('Chặng đã bị xoá.');
      const items = { ...sub.items };
      allQuestions(s.test).filter(isManual).forEach((q) => { items[q.id] = Math.min(qPoints(q), Math.max(0, Number(manual[q.id]) || 0)); });
      const earned = Object.values(items).reduce((n, v) => n + (Number(v) || 0), 0);
      const pct = pctOf(earned, sub.total), passed = pct >= passPct(s);
      const nsub = { ...sub, items, earned, pct, passed, status: 'graded', feedback: feedback || '', gradedAt: Date.now(), gradedBy: grader.email };
      write(K.subs, all.map((x) => (x.id === id ? nsub : x)));
      saveUsers(users().map((x) => {
        if (x.id !== sub.userId) return x;
        const prev = ((x.progress || {}).tests || {})[sub.stageId] || {};
        const rec = { ...prev, pending: prev.lastSub === id ? false : prev.pending, best: Math.max(prev.best || 0, pct), last: pct, passed: !!prev.passed || passed, feedback: feedback || '' };
        return { ...x, progress: { ...(x.progress || {}), tests: { ...((x.progress || {}).tests || {}), [sub.stageId]: rec } } };
      }));
      return nsub;
    },
    // tệp âm thanh / hình ảnh: bản lưu trên trình duyệt giữ dạng data URL (giới hạn dung lượng)
    async uploadMedia(file) {
      require('editor');
      if (file.size > 3 * 1024 * 1024) throw new Error('Tệp quá lớn (tối đa 3 MB ở chế độ lưu trên trình duyệt). Hãy dán đường dẫn tệp thay vì tải lên.');
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Không đọc được tệp')); r.readAsDataURL(file); });
    },
    async uploadRecording(blob) {
      require('member');
      if (blob.size > 1.5 * 1024 * 1024) throw new Error('Bản ghi quá dài, hãy ghi ngắn hơn.');
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Không đọc được bản ghi')); r.readAsDataURL(blob); });
    },
    async recordingUrl(ref) { return ref; },

    // ---- Nâng cấp tài khoản (chuyển khoản, admin xác nhận)
    async myUpgrade() {
      const u = require('member');
      return read(K.upgrades, []).filter((r) => r.userId === u.id).sort((a, b) => b.createdAt - a.createdAt)[0] || null;
    },
    async createUpgrade() {
      const u = require('member');
      if (tierOf(publicUser(u)) !== 'member') throw new Error('Tài khoản của bạn không cần nâng cấp.');
      const all = read(K.upgrades, []);
      const open = all.find((r) => r.userId === u.id && (r.status === 'pending' || r.status === 'claimed'));
      if (open) return open;
      let code; do { code = newTxnCode(); } while (all.some((r) => r.code === code));
      const plan = db.settings.plan || DEFAULT_PLAN;
      const r = { id: uid('up'), userId: u.id, name: u.name, email: u.email, code, amount: plan.price, months: plan.months || 0, status: 'pending', createdAt: Date.now() };
      write(K.upgrades, [...all, r]); return r;
    },
    async claimUpgrade(id) {
      const u = require('member');
      const all = read(K.upgrades, []);
      write(K.upgrades, all.map((r) => (r.id === id && r.userId === u.id && r.status === 'pending' ? { ...r, status: 'claimed', claimedAt: Date.now() } : r)));
    },
    async cancelUpgrade(id) {
      const u = require('member');
      const all = read(K.upgrades, []);
      const r = all.find((x) => x.id === id); if (!r) return;
      if (r.userId !== u.id && u.role !== 'admin') throw new Error('Bạn không có quyền huỷ yêu cầu này.');
      if (r.status === 'paid') throw new Error('Yêu cầu đã được xác nhận, không huỷ được.');
      write(K.upgrades, all.map((x) => (x.id === id ? { ...x, status: 'cancelled', closedAt: Date.now() } : x)));
    },
    async listUpgrades() { require('admin'); return read(K.upgrades, []).sort((a, b) => b.createdAt - a.createdAt); },
    async confirmUpgrade(id) {
      const admin = require('admin');
      const all = read(K.upgrades, []);
      const r = all.find((x) => x.id === id); if (!r) throw new Error('Không tìm thấy yêu cầu.');
      if (r.status === 'paid') return r;
      if (r.status === 'cancelled') throw new Error('Yêu cầu đã huỷ.');
      const list = users().map((x) => {
        if (x.id !== r.userId) return x;
        const base = Math.max(Date.now(), x.studentUntil || 0);
        return { ...x, role: x.role === 'member' || x.role === 'student' ? 'student' : x.role, studentUntil: r.months > 0 ? base + r.months * 30 * 86400000 : null };
      });
      saveUsers(list);
      const nr = { ...r, status: 'paid', paidAt: Date.now(), confirmedBy: admin.email };
      write(K.upgrades, all.map((x) => (x.id === id ? nr : x))); return nr;
    },

    // ---- Sao lưu
    async exportContent() { require('admin'); db.publishedAt = Date.now(); persist(); return structuredClone(db); },
    async importContent(json) {
      require('admin');
      if (!json || !Array.isArray(json.documents) || !Array.isArray(json.stages) || !json.settings) throw new Error('File không đúng định dạng sao lưu của Mọt.');
      db = upgradeDb(json); persist();
    },
    async resetContent() { require('admin'); db = buildSeed(); persist(); },
  };
}
