// Quy tắc dùng chung: phân quyền theo loại tài khoản, tách dữ liệu công khai / dành cho học viên,
// tính trạng thái mở khoá các chặng.

// ----- Loại tài khoản -----
// guest   : chưa đăng nhập
// member  : tài khoản thường (đã đăng nhập, chưa nâng cấp) — xem Kho tài liệu, lộ trình chỉ xem khung
// student : học viên (admin kích hoạt sau khi nhận chuyển khoản) — học lộ trình, làm bài kiểm tra
// staff   : biên tập / quản trị — quản lý nội dung, xem trước toàn bộ lộ trình
export function tierOf(u) {
  if (!u || u.status !== 'active') return 'guest';
  if (u.role === 'admin' || u.role === 'editor') return 'staff';
  if (u.role === 'student' && (!u.studentUntil || u.studentUntil > Date.now())) return 'student';
  return 'member';
}
export const canLearn = (u) => ['student', 'staff'].includes(tierOf(u));

// ----- Tách dữ liệu chặng -----
// Phần công khai: ai cũng xem được (khung lộ trình). Phần chi tiết: chỉ học viên trở lên.
export const STAGE_PUBLIC = ['id', 'order', 'key', 'emoji', 'color', 'whiteText', 'title', 'badge', 'desc', 'chips'];
// Phần cài đặt chỉ học viên trở lên được tải: link mua, túi đồ nghề, app học, prompt
export const SETTINGS_PREMIUM = ['affiliate', 'tools', 'apps', 'prompts'];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

/** stage đầy đủ → { pub, detail, key } — key là đáp án bài kiểm tra (chỉ biên tập/quản trị đọc được) */
export function splitStage(s) {
  const pub = pick(s, STAGE_PUBLIC);
  const detail = omit(s, STAGE_PUBLIC);
  let key = null;
  if (s.test && Array.isArray(s.test.questions)) {
    key = { answers: s.test.questions.map((q) => (Number.isInteger(q.answer) ? q.answer : 0)) };
    detail.test = { ...s.test, questions: s.test.questions.map(({ answer, ...q }) => q) }; // eslint-disable-line no-unused-vars
  }
  return { pub, detail: { id: s.id, ...detail }, key };
}
export function mergeStage(pub, detail, key) {
  const s = { ...pub, ...(detail ? omit(detail, ['id']) : {}) };
  if (s.test && key && Array.isArray(key.answers)) {
    s.test = { ...s.test, questions: s.test.questions.map((q, i) => ({ ...q, answer: key.answers[i] ?? 0 })) };
  }
  return s;
}
export const splitSettings = (st) => ({ pub: omit(st, SETTINGS_PREMIUM), premium: pick(st, SETTINGS_PREMIUM) });

/** Lọc nội dung đầy đủ theo loại tài khoản (dùng cho chế độ lưu trên trình duyệt; Supabase làm bằng RLS) */
export function viewFor(full, tier) {
  const c = structuredClone(full);
  if (tier !== 'staff') c.documents = c.documents.filter((d) => d.published !== false);
  if (tier === 'staff') return c;
  if (tier === 'student') {
    c.stages = c.stages.map((s) => (s.test ? { ...s, test: { ...s.test, questions: s.test.questions.map(({ answer, ...q }) => q) } } : s)); // eslint-disable-line no-unused-vars
    return c;
  }
  c.stages = c.stages.map((s) => pick(s, STAGE_PUBLIC));
  c.settings = omit(c.settings, SETTINGS_PREMIUM);
  return c;
}

// ----- Bài kiểm tra & mở khoá -----
export const hasTest = (s) => !!(s && s.test && Array.isArray(s.test.questions) && s.test.questions.length);
export const passPct = (s) => (s && s.test && Number(s.test.pass)) || 70;

export function grade(stage, answers) {
  const qs = stage.test.questions;
  const score = qs.reduce((n, q, i) => n + (Number(answers[i]) === q.answer ? 1 : 0), 0);
  const pct = Math.round((score / qs.length) * 100);
  return { score, total: qs.length, pct, passed: pct >= passPct(stage) };
}

/** Trạng thái từng chặng của một học viên: passed | open | locked (+ điểm cao nhất) */
export function stageStates(stages, progress = {}) {
  const tests = progress.tests || {};
  const done = progress.done || [];
  const out = [];
  let prevPassed = true;
  for (const s of stages) {
    const t = tests[s.id];
    const passed = hasTest(s) ? !!(t && t.passed) : done.includes(s.id);
    const state = passed ? 'passed' : prevPassed ? 'open' : 'locked';
    out.push({ id: s.id, state, best: t ? t.best : null, attempts: t ? t.attempts || 0 : 0 });
    prevPassed = passed;
  }
  return out;
}

/** Câu hỏi mẫu tạo từ danh sách bài học: "「你好」 nghĩa là gì?" — 4 lựa chọn */
export function questionsFromLessons(lessons, n = 10) {
  const pool = lessons.filter((l) => l[0] && l[1]);
  if (pool.length < 4) return [];
  const step = Math.max(1, Math.floor(pool.length / n));
  const qs = [];
  for (let i = 0; i < pool.length && qs.length < n; i += step) {
    const [zh, vi] = pool[i];
    const wrong = [1, 2, 3].map((k) => pool[(i + k * 3 + 1) % pool.length][1]).filter((x) => x !== vi);
    const opts = [vi, ...wrong.slice(0, 3)];
    const rot = qs.length % 4; // đổi vị trí đáp án đúng
    const options = [...opts.slice(opts.length - rot), ...opts.slice(0, opts.length - rot)];
    qs.push({ q: `Bài “${zh}” có nghĩa là gì?`, options, answer: options.indexOf(vi) });
  }
  return qs;
}

/** Mã giao dịch nâng cấp: MOT + 6 ký tự dễ đọc (bỏ 0/O/1/I) */
export function newTxnCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(6));
  return 'MOT' + Array.from(r, (x) => A[x % A.length]).join('');
}

/** Ảnh QR VietQR có sẵn số tiền + nội dung chuyển khoản (dịch vụ miễn phí img.vietqr.io) */
export function vietQrUrl(bank, amount, info) {
  if (!bank || !bank.bankId || !bank.number) return '';
  const q = new URLSearchParams({ amount: String(amount || ''), addInfo: info || '', accountName: bank.owner || '' });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankId)}-${encodeURIComponent(bank.number)}-compact2.png?${q}`;
}

export const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
export const DEFAULT_PLAN = {
  name: 'Học viên Mọt Tiếng Trung',
  price: 199000,
  months: 0,
  benefits: ['Mở toàn bộ lộ trình 9 chặng, từ Vỡ lòng tới HSK 7–9', 'Chi tiết từng chặng: bài học, giáo trình, tài liệu đi kèm', 'Bài kiểm tra cuối chặng, lưu điểm và tiến độ cá nhân', 'Túi đồ nghề và hướng dẫn app học'],
};
