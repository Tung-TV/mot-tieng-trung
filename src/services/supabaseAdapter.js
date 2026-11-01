// Backend dùng chung (tuỳ chọn): Supabase gói Free, gọi thẳng REST API — không cần cài SDK.
// Cần chạy docs/supabase.sql trên project Supabase trước, rồi đặt VITE_BACKEND=supabase,
// VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env
import { buildSeed } from './seed.js';
import { mergeStage, splitSettings, splitStage, stageLevel, tierOf, viewFor } from './model.js';

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
  const toUser = (p) => p && ({ id: p.id, name: p.name, email: p.email, role: p.role, status: p.status, createdAt: Date.parse(p.created_at), progress: p.progress || {}, avatar: p.avatar || '', providers: p.providers || [p.provider || 'email'], studentUntil: p.student_until ? Date.parse(p.student_until) : null });
  const toUp = (r) => r && ({ id: r.id, userId: r.user_id, name: r.name, email: r.email, code: r.code, amount: r.amount, months: r.months, status: r.status, createdAt: Date.parse(r.created_at), claimedAt: r.claimed_at && Date.parse(r.claimed_at), paidAt: r.paid_at && Date.parse(r.paid_at), confirmedBy: r.confirmed_by });
  const rpc = (fn, body = {}) => rest('rpc/' + fn, { method: 'POST', body });
  const toSub = (r) => r && ({ id: r.id, userId: r.user_id, name: r.name, email: r.email, stageId: r.stage_id, stageKey: r.stage_key, answers: r.answers || {}, items: r.items || {}, auto: r.auto, earned: r.earned, total: r.total, manualTotal: r.manual_total, status: r.status, pct: r.pct, passed: r.passed, feedback: r.feedback, createdAt: Date.parse(r.created_at), gradedAt: r.graded_at && Date.parse(r.graded_at), gradedBy: r.graded_by });
  async function storagePut(bucket, path, body) {
    if (session && session.expires_at * 1000 < Date.now() + 30000) await refresh();
    const r = await fetch(url + '/storage/v1/object/' + bucket + '/' + path, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + session.access_token, 'Content-Type': body.type || 'application/octet-stream', 'x-upsert': 'true' }, body });
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch { /* */ } throw new Error('Tải tệp lên không được: ' + (m || r.status)); }
  }
  const inIds = (ids) => 'id=in.(' + ids.map((x) => '"' + encodeURIComponent(x) + '"').join(',') + ')';

  // Một chặng được lưu thành 3 dòng: công khai (stage), chi tiết cho học viên (stage_detail), đáp án (test_key)
  function stageRows(st, i) {
    const { pub, detail, key } = splitStage({ ...st, order: i });
    const rows = [{ id: st.id, kind: 'stage', sort: i, data: pub }, { id: 'sd:' + st.id, kind: 'stage_detail', sort: i, data: detail }];
    if (key) rows.push({ id: 'tk:' + st.id, kind: 'test_key', sort: i, data: { id: st.id, ...key } });
    return rows;
  }
  function settingsRows(st) {
    const { pub, premium } = splitSettings(st);
    return [{ id: 'settings', kind: 'settings', sort: 0, data: pub }, { id: 'premium', kind: 'premium', sort: 0, data: premium }];
  }
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
    // RLS trong database tự lọc: khách/thành viên không nhận được stage_detail, premium, test_key
    async getContent() {
      const rows = await rest('content?select=*&order=sort.asc');
      if (!rows.length) {
        const t = tierOf(await myProfile());
        // database còn trống: biên tập/quản trị đăng nhập lần đầu thì ghi dữ liệu gốc vào để bài kiểm tra chấm được
        if (t === 'staff' && !seeded) { try { await ensureSeeded(this); return this.getContent(); } catch { /* chưa đủ quyền ghi */ } }
        return viewFor(buildSeed(), t);
      }
      const pick = (k) => rows.filter((r) => r.kind === k).map((r) => r.data);
      const byId = (k) => Object.fromEntries(pick(k).map((d) => [d.id, d]));
      const det = byId('stage_detail'), keys = byId('test_key'), links = byId('doc_link');
      const settings = rows.find((r) => r.kind === 'settings'), premium = rows.find((r) => r.kind === 'premium');
      return {
        version: 1,
        // tài liệu đặt “Học viên”: link nằm ở dòng doc_link, chỉ học viên/biên tập đọc được
        documents: pick('document').map((d) => (links[d.id] ? { ...d, url: links[d.id].url } : d)),
        stages: pick('stage').map((p) => mergeStage(p, det[p.id], keys[p.id])),
        settings: { ...(settings ? settings.data : buildSeed().settings), ...(premium ? premium.data : {}) },
      };
    },
    async saveDocument(doc) {
      await ensureSeeded(this);
      const d = { ...doc, id: doc.id || 'doc_' + crypto.randomUUID().slice(0, 8), createdAt: doc.createdAt || Date.now() };
      if (d.access === 'student') {
        const { url, ...pub } = d;
        await upsert('content', [{ id: d.id, kind: 'document', sort: -d.createdAt, data: pub }, { id: 'dl:' + d.id, kind: 'doc_link', sort: 0, data: { id: d.id, url: url || '' } }]);
      } else {
        await upsert('content', { id: d.id, kind: 'document', sort: -d.createdAt, data: d });
        await rest('content?id=eq.' + encodeURIComponent('dl:' + d.id), { method: 'DELETE' });
      }
      return d;
    },
    async deleteDocument(id) { await ensureSeeded(this); await rest('content?' + inIds([id, 'dl:' + id]), { method: 'DELETE' }); },
    async bumpDownload(id) { try { await rest('rpc/bump_download', { method: 'POST', body: { doc_id: id } }); } catch { /* bỏ qua */ } },
    async saveStage(stage) {
      await ensureSeeded(this);
      const s = { ...stage, id: stage.id || 'stage_' + crypto.randomUUID().slice(0, 8) };
      const order = stage.order ?? (await this.getContent()).stages.length;
      const rows = stageRows(s, order);
      await upsert('content', rows.slice(0, 2));
      if (rows[2]) await upsert('content', rows[2]); else await rest('content?id=eq.' + encodeURIComponent('tk:' + s.id), { method: 'DELETE' });
      return { ...s, order };
    },
    async deleteStage(id) { await ensureSeeded(this); await rest('content?' + inIds([id, 'sd:' + id, 'tk:' + id]), { method: 'DELETE' }); },
    async reorderStages(ids) {
      await ensureSeeded(this);
      const { stages } = await this.getContent();
      await upsert('content', stages.map((s) => stageRows(s, ids.indexOf(s.id))[0]));
    },
    async saveSettings(settings) { await ensureSeeded(this); await upsert('content', settingsRows(settings)); },

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
      if ('studentUntil' in patch) body.student_until = patch.studentUntil ? new Date(patch.studentUntil).toISOString() : null;
      await rest('profiles?id=eq.' + id, { method: 'PATCH', body });
      return toUser((await rest('profiles?id=eq.' + id + '&select=*'))[0]);
    },
    async deleteUser(id) { await rest('profiles?id=eq.' + id, { method: 'DELETE' }); },
    async exportContent() { return this.getContent(); },
    async importContent(json) {
      const rows = [
        ...json.documents.map((d) => ({ id: d.id, kind: 'document', sort: -(d.createdAt || 0), data: d })),
        ...json.stages.flatMap((s, i) => stageRows(s, i)),
        ...settingsRows(json.settings),
      ];
      await rest('content?id=neq.__none__', { method: 'DELETE' });
      await upsert('content', rows);
    },
    async resetContent() { await this.importContent(buildSeed()); },

    // ---- Bài học của Khoá học: mỗi bài một dòng kind = 'lesson' (RLS: chỉ Học viên, trừ bài Miễn phí)
    async getLesson(level, n) {
      const r = await rest('content?select=data&id=eq.' + encodeURIComponent('ls:' + level + '-' + n));
      if (!r.length) {
        const t = tierOf(await myProfile());
        throw new Error(t === 'student' || t === 'staff' ? 'Bài học này chưa có nội dung.' : 'Bài học dành cho Học viên Khoá học Mọt Tiếng Trung.');
      }
      return r[0].data;
    },
    async saveLead(id, data) { await rest('rpc/save_lead', { method: 'POST', body: { p_id: id, p_data: data } }); },
    async listLeads() {
      return (await rest('roadmap_leads?select=*&order=updated_at.desc&limit=2000')).map((r) => ({ id: r.id, userId: r.user_id, data: r.data, done: r.done, createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at) }));
    },
    async listLessons(level) {
      return (await rest('content?select=data&kind=eq.lesson&id=like.' + encodeURIComponent('ls:' + level + '-*') + '&order=sort.asc')).map((r) => r.data);
    },
    async saveLesson(lesson) { await this.importLessons([lesson]); return lesson; },
    async importLessons(list) {
      const rows = list.map((l) => ({ id: 'ls:' + l.id, kind: 'lesson', sort: l.level * 1000 + l.n, data: { ...l, updatedAt: Date.now() } }));
      for (let i = 0; i < rows.length; i += 15) await upsert('content', rows.slice(i, i + 15));
      // tên bài + bài miễn phí trong danh sách của chặng
      const { stages } = await this.getContent();
      for (const s of stages) {
        const lv = stageLevel(s), mine = list.filter((l) => l.level === lv);
        if (!mine.length) continue;
        const lessons = [...(s.lessons || [])], free = new Set(s.freeLessons || []);
        mine.forEach((l) => { lessons[l.n - 1] = [l.title, l.vi || '']; if (l.free) free.add(l.n); else free.delete(l.n); });
        await this.saveStage({ ...s, lessons: Array.from(lessons, (x) => x || ['', '']), freeLessons: [...free].sort((a, b) => a - b) });
      }
      return list.length;
    },

    // ---- Học tập: chấm điểm trong database (đáp án không bao giờ gửi xuống trình duyệt của học viên)
    async submitTest(stageId, answers) {
      const r = await rpc('submit_test', { p_stage: stageId, p_answers: answers || {} });
      return { ...r, user: await myProfile() };
    },
    async completeStage(stageId) { await rpc('complete_stage', { p_stage: stageId }); return myProfile(); },
    async mySubmissions(stageId) {
      if (!session) return [];
      return (await rest('test_submissions?select=*&user_id=eq.' + session.user.id + (stageId ? '&stage_id=eq.' + encodeURIComponent(stageId) : '') + '&order=created_at.desc')).map(toSub);
    },
    async listSubmissions() { return (await rest('test_submissions?select=*&order=created_at.desc&limit=300')).map(toSub); },
    async gradeSubmission(id, manual, feedback) { return toSub(await rpc('grade_submission', { p_id: id, p_manual: manual || {}, p_feedback: feedback || '' })); },
    // Âm thanh/hình cho đề thi → bucket công khai "media"; bản ghi âm của học viên → bucket riêng "speaking"
    async uploadMedia(file) {
      const path = 'de-thi/' + Date.now().toString(36) + '-' + file.name.replace(/[^\w.-]+/g, '_');
      await storagePut('media', path, file);
      return url + '/storage/v1/object/public/media/' + path;
    },
    async uploadRecording(blob) {
      const path = session.user.id + '/' + Date.now().toString(36) + '.webm';
      await storagePut('speaking', path, blob);
      return 'speaking:' + path;
    },
    // AI chấm phát âm (Cloudflare Pages Function /api/ai-speak, kiểm tra Học viên bằng phiên Supabase)
    async aiSpeak(wav, s) {
      if (!session) throw new Error('Bạn cần đăng nhập tài khoản Học viên.');
      if (session.expires_at * 1000 < Date.now() + 30000) await refresh();
      const f = new FormData(); f.append('audio', wav, 'speak.wav'); f.append('target', s[0]); f.append('pinyin', s[1] || ''); f.append('meaning', s[2] || '');
      const r = await fetch('api/ai-speak', { method: 'POST', headers: { Authorization: 'Bearer ' + session.access_token }, body: f });
      const j = await r.json().catch(() => ({ error: 'AI chưa sẵn sàng (' + r.status + ').' }));
      if (!r.ok || j.error) throw new Error(j.error || 'AI chưa sẵn sàng.');
      return j;
    },
    async recordingUrl(ref) {
      if (!String(ref).startsWith('speaking:')) return ref;
      const r = await fetch(url + '/storage/v1/object/authenticated/speaking/' + ref.slice(9), { headers: { apikey: anonKey, Authorization: 'Bearer ' + session.access_token } });
      if (!r.ok) throw new Error('Không tải được bản ghi âm');
      return URL.createObjectURL(await r.blob());
    },

    // ---- Nâng cấp tài khoản
    async myUpgrade() {
      if (!session) throw new Error('Vui lòng đăng nhập.');
      const rows = await rest('upgrade_requests?select=*&user_id=eq.' + session.user.id + '&order=created_at.desc&limit=1');
      return toUp(rows[0]) || null;
    },
    async createUpgrade() { return toUp(await rpc('create_upgrade_request')); },
    async claimUpgrade(id) { await rpc('claim_upgrade', { p_id: id }); },
    async cancelUpgrade(id) { await rpc('cancel_upgrade', { p_id: id }); },
    async listUpgrades() { return (await rest('upgrade_requests?select=*&order=created_at.desc')).map(toUp); },
    async confirmUpgrade(id) { return toUp(await rpc('confirm_upgrade', { p_id: id })); },
  };
}
