// Quy tắc dùng chung: phân quyền theo loại tài khoản, tách dữ liệu công khai / dành cho học viên,
// tính trạng thái mở khoá các chặng.

// ----- Loại tài khoản -----
// guest   : chưa đăng nhập
// member  : tài khoản thường (đã đăng nhập, chưa nâng cấp) — xem Kho tài liệu + danh sách lộ trình, học phần admin đặt “Miễn phí”
// student : học viên Khoá học Mọt Tiếng Trung (admin kích hoạt sau khi nhận chuyển khoản) — vào học mọi chặng, bài học, tài liệu
// staff   : biên tập / quản trị — quản lý nội dung, xem trước toàn bộ lộ trình
export function tierOf(u) {
  if (!u || u.status !== 'active') return 'guest';
  if (u.role === 'admin' || u.role === 'editor') return 'staff';
  if (u.role === 'student' && (!u.studentUntil || u.studentUntil > Date.now())) return 'student';
  return 'member';
}
export const canLearn = (u) => ['student', 'staff'].includes(tierOf(u));
const paid = (tier) => tier === 'student' || tier === 'staff';
/** Vào học một chặng: Học viên, hoặc chặng admin đặt Miễn phí */
export const canEnterStage = (s, tier) => paid(tier) || !!(s && s.free);
/** Mở một bài học của Khoá học: Học viên, hoặc bài admin đặt Miễn phí (học thử) */
export const canOpenLesson = (stage, n, tier) => paid(tier) || ((stage && stage.freeLessons) || []).includes(Number(n));
/** Tài liệu: access = 'free' (mặc định) | 'student' */
export const docLocked = (d, tier) => d.access === 'student' && !paid(tier);
/** Cấp HSK của chặng (HSK1 → 1), không phải chặng HSK thì null */
export const stageLevel = (s) => { const m = /^HSK\s*([1-6])\b/.exec((s && s.title) || ''); return m ? +m[1] : null; };
/** Trạng thái học một bài: new | doing | done */
export const lessonState = (progress, id) => ((progress && progress.lessons && progress.lessons[id]) || {}).s || 'new';

// ----- Tách dữ liệu chặng -----
// Phần công khai: ai cũng xem được (khung lộ trình). Phần chi tiết: chỉ học viên trở lên.
export const STAGE_PUBLIC = ['id', 'order', 'key', 'emoji', 'color', 'whiteText', 'title', 'badge', 'desc', 'chips'];
// Phần cài đặt chỉ học viên trở lên được tải: link mua, túi đồ nghề, app học, prompt
export const SETTINGS_PREMIUM = ['affiliate', 'tools', 'apps', 'prompts'];

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));

// ----- Bài kiểm tra kiểu HSK -----
// test = { pass, minutes, sections: [{ id, skill, title, intro, audio, image, passage, questions: [q] }] }
// q    = { id, type, prompt, points, image?, options?, tokens?, key? }   (key = đáp án, chỉ biên tập/quản trị thấy)
//   choice    : chọn 1 đáp án             key = { answer: số thứ tự }
//   truefalse : đúng / sai                key = { answer: 0 (Đúng) | 1 (Sai) }
//   fill      : điền từ                   key = { accept: ['đáp án 1', 'cách viết khác', …] }
//   order     : sắp xếp từ thành câu      key = { answer: ['我', '是', '学生'] } — học viên thấy tokens đã xáo
//   write     : viết tự luận (chấm tay)   key = { guide: 'gợi ý chấm / bài mẫu' }
//   speak     : nói, ghi âm (chấm tay)    key = { guide: 'gợi ý chấm' }
export const SKILLS = { listening: ['Nghe', '🎧'], reading: ['Đọc', '📖'], writing: ['Viết', '✍️'], speaking: ['Nói', '🗣️'] };
export const QTYPES = { choice: 'Trắc nghiệm', truefalse: 'Đúng / Sai', fill: 'Điền từ', order: 'Sắp xếp câu', write: 'Viết tự luận (chấm tay)', speak: 'Nói – ghi âm (chấm tay)' };
export const MANUAL_TYPES = ['write', 'speak'];
export const isManual = (q) => MANUAL_TYPES.includes(q.type);
export const qPoints = (q) => Math.max(0, Number(q.points) || 1);

export const rid = (p) => p + Math.random().toString(36).slice(2, 8);
// mã cố định theo nội dung (dữ liệu mẫu dựng lại nhiều lần vẫn cùng mã câu)
const hid = (p, str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return p + (h >>> 0).toString(36); };
/** Đổi định dạng cũ { questions:[{q, options, answer}] } sang dạng có phần thi */
export function normTest(t) {
  if (!t) return null;
  if (Array.isArray(t.sections)) return t;
  if (!Array.isArray(t.questions)) return null;
  return {
    pass: t.pass || 70, minutes: t.minutes || 0,
    sections: [{ id: 's1', skill: 'reading', title: 'Đọc hiểu', intro: 'Chọn đáp án đúng.', questions: t.questions.map((q, i) => ({
      id: 'q' + (i + 1), type: 'choice', prompt: q.q, options: q.options, points: 1, ...(Number.isInteger(q.answer) ? { key: { answer: q.answer } } : {}),
    })) }],
  };
}
export const allQuestions = (t) => (t && t.sections ? t.sections.flatMap((s) => s.questions || []) : []);
/** Chặng này hoàn thành bằng nút (không cần bài kiểm tra) hay bằng bài kiểm tra */
export const byButton = (s) => !!s && s.completion === 'button';
export const hasTest = (s) => allQuestions(s && s.test).length > 0;
export const passPct = (s) => (s && s.test && Number(s.test.pass)) || 70;
const stripKeys = (t) => t && { ...t, sections: t.sections.map((sec) => ({ ...sec, questions: sec.questions.map(({ key, ...q }) => q) })) }; // eslint-disable-line no-unused-vars

/** stage đầy đủ → { pub, detail, key } — key = { keys: { [mã câu]: đáp án } } chỉ biên tập/quản trị đọc được */
export function splitStage(s0) {
  const s = { ...s0, test: normTest(s0.test) };
  const pub = pick(s, STAGE_PUBLIC);
  const detail = omit(s, STAGE_PUBLIC);
  let key = null;
  if (s.test) {
    const keys = {};
    allQuestions(s.test).forEach((q) => { keys[q.id] = { type: q.type, points: qPoints(q), ...(q.key || {}) }; });
    key = { keys };
    detail.test = stripKeys(s.test);
  }
  return { pub, detail: { id: s.id, ...detail }, key };
}
export function mergeStage(pub, detail, key) {
  const s = { ...pub, ...(detail ? omit(detail, ['id']) : {}) };
  s.test = normTest(s.test);
  if (s.test && key && key.keys) {
    s.test = { ...s.test, sections: s.test.sections.map((sec) => ({ ...sec, questions: sec.questions.map((q) => {
      const k = key.keys[q.id]; if (!k) return q;
      const { type, points, ...rest } = k; // eslint-disable-line no-unused-vars
      return { ...q, key: rest };
    }) })) };
  }
  return s;
}
export const splitSettings = (st) => ({ pub: omit(st, SETTINGS_PREMIUM), premium: pick(st, SETTINGS_PREMIUM) });

/** Lọc nội dung đầy đủ theo loại tài khoản (dùng cho chế độ lưu trên trình duyệt; Supabase làm bằng RLS) */
export function viewFor(full, tier) {
  const c = structuredClone(full);
  c.stages = c.stages.map((s) => ({ ...s, test: normTest(s.test) }));
  if (tier !== 'staff') c.documents = c.documents.filter((d) => d.published !== false);
  if (tier === 'staff') return c;
  // Danh sách lộ trình xem miễn phí (đủ chi tiết), chỉ ẩn đáp án. Tài liệu đặt “Học viên” thì ẩn link với người chưa nâng cấp.
  c.stages = c.stages.map((s) => (s.test ? { ...s, test: stripKeys(s.test) } : s));
  if (tier !== 'student') c.documents = c.documents.map((d) => (d.access === 'student' ? omit(d, ['url']) : d));
  return c;
}

// ----- Chấm điểm -----
export const normAnswer = (x) => String(x ?? '').toLowerCase().normalize('NFC').replace(/[\s\p{P}\p{S}]/gu, '');
/** Chấm phần tự động. answers = { [mã câu]: trả lời }. Trả về điểm từng câu (null = chờ chấm tay) */
export function gradeAuto(test, answers = {}) {
  const items = {};
  let earned = 0, total = 0, manual = 0;
  for (const q of allQuestions(test)) {
    const pts = qPoints(q), a = answers[q.id], k = q.key || {};
    total += pts;
    if (isManual(q)) { manual += pts; items[q.id] = null; continue; }
    let ok = false;
    if (q.type === 'choice' || q.type === 'truefalse') ok = a !== undefined && a !== null && a !== '' && Number(a) === Number(k.answer);
    else if (q.type === 'fill') ok = normAnswer(a) !== '' && (k.accept || []).some((x) => normAnswer(x) === normAnswer(a));
    else if (q.type === 'order') ok = Array.isArray(a) && Array.isArray(k.answer) && a.join('\u0001') === k.answer.join('\u0001');
    items[q.id] = ok ? pts : 0; earned += ok ? pts : 0;
  }
  return { items, earned, total, manual };
}
export const pctOf = (earned, total) => (total ? Math.round((earned * 100) / total) : 0);

/** Xáo trộn cố định (cùng câu luôn cùng thứ tự) cho câu sắp xếp */
export function shuffled(arr, seed = 'x') {
  let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 13), 1274126177); const j = Math.abs(h) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  if (a.length > 1 && a.every((x, i) => x === arr[i])) a.push(a.shift());
  return a;
}

/** Trạng thái từng chặng của một học viên: passed | open | locked (+ điểm cao nhất, đang chờ chấm) */
export function stageStates(stages, progress = {}) {
  const tests = progress.tests || {};
  const done = progress.done || [];
  const out = [];
  let prevPassed = true;
  for (const s of stages) {
    const t = tests[s.id];
    const passed = byButton(s) ? done.includes(s.id) : !!(t && t.passed);
    const state = passed ? 'passed' : prevPassed ? 'open' : 'locked';
    out.push({ id: s.id, state, best: t ? t.best ?? null : null, attempts: t ? t.attempts || 0 : 0, pending: !!(t && t.pending) });
    prevPassed = passed;
  }
  return out;
}

/** Bài kiểm tra mẫu tạo từ danh sách bài học: phần Đọc (trắc nghiệm) + phần Viết (sắp xếp câu) */
export function testFromLessons(lessons, n = 8, extra = {}) {
  const pool = lessons.filter((l) => l[0] && l[1]);
  if (pool.length < 4) return null;
  const step = Math.max(1, Math.floor(pool.length / n));
  const qs = [];
  for (let i = 0; i < pool.length && qs.length < n; i += step) {
    const [zh, vi] = pool[i];
    const wrong = [1, 2, 3].map((k) => pool[(i + k * 3 + 1) % pool.length][1]).filter((x) => x !== vi);
    const opts = [vi, ...wrong.slice(0, 3)];
    const rot = qs.length % 4; // đổi vị trí đáp án đúng
    const options = [...opts.slice(opts.length - rot), ...opts.slice(0, opts.length - rot)];
    qs.push({ id: hid('q', 'c' + zh), type: 'choice', prompt: `“${zh}” có nghĩa là gì?`, options, points: 1, key: { answer: options.indexOf(vi) } });
  }
  // sắp xếp lại các chữ Hán của 2 câu ngắn nhất thành câu đúng
  const orders = pool.map((l) => l[0].replace(/[，。！？、,.!?；：“”]/g, '')).filter((z) => /^[一-鿿]{3,8}$/.test(z)).sort((a, b) => a.length - b.length).slice(0, 2)
    .map((z) => ({ id: hid('q', 'o' + z), type: 'order', prompt: 'Sắp xếp các chữ thành câu đúng', tokens: shuffled([...z], z), points: 2, key: { answer: [...z] } }));
  const sections = [{ id: 's1', skill: 'reading', title: 'Phần 1 · Đọc hiểu', intro: 'Chọn nghĩa tiếng Việt đúng của mỗi câu.', questions: qs }];
  const fill = pool.find((l) => /^[\u4e00-\u9fff，。！？]{2,10}$/.test(l[0]));
  if (fill) { const zh = fill[0].replace(/[，。！？、,.!?；：“”]/g, ''); orders.push({ id: hid('q', 'f' + zh), type: 'fill', prompt: `Viết lại bằng chữ Hán câu có nghĩa: “${fill[1]}”`, points: 2, key: { accept: [zh] } }); }
  if (extra.write) orders.push({ id: hid('q', 'w' + extra.write), type: 'write', prompt: extra.write, points: 3, key: { guide: 'Đúng chữ Hán, đúng ngữ pháp, đủ ý: 3 điểm. Sai 1–2 chỗ: 2 điểm. Chỉ viết được một phần: 1 điểm.' } });
  if (orders.length) sections.push({ id: 's2', skill: 'writing', title: 'Phần 2 · Viết', intro: 'Ghép câu, viết chữ Hán theo yêu cầu.', questions: orders });
  if (extra.speak) sections.push({ id: 's3', skill: 'speaking', title: 'Phần 3 · Nói', intro: 'Bấm “Ghi âm”, đọc to rõ ràng rồi bấm “Dừng”. Có thể ghi lại nhiều lần trước khi nộp.', questions: [{ id: hid('q', 's' + extra.speak), type: 'speak', prompt: extra.speak, points: 3, key: { guide: 'Phát âm đúng thanh điệu, trôi chảy: 3 điểm.' } }] });
  return { pass: 70, minutes: 20, sections };
}

/** Bài kiểm tra mẫu cho chặng “Bắt đầu”, dựng từ túi đồ nghề (admin sửa lại trong CMS) */
export function starterTest(tools = []) {
  const t = tools.filter((x) => x && x.t && x.d);
  if (t.length < 2) return null;
  const qs = t.map((x, i) => ({ id: hid('q', 't' + x.t), type: 'choice', prompt: `“${x.t}” dùng để làm gì?`, options: shuffled(t.map((y) => y.d), x.k || String(i)), points: 1 }));
  qs.forEach((q, i) => { q.key = { answer: q.options.indexOf(t[i].d) }; });
  qs.push({ id: 'qtf1', type: 'truefalse', prompt: 'Nên chuẩn bị giáo trình, bút và vở ô ly trước khi bắt đầu học.', points: 1, key: { answer: 0 } });
  return { pass: 70, minutes: 10, sections: [{ id: 's1', skill: 'reading', title: 'Kiểm tra chuẩn bị', intro: 'Bài mẫu: quản trị viên có thể sửa trong CMS › Lộ trình học.', questions: qs }] };
}

/** Mã giao dịch nâng cấp: MOT + 6 ký tự dễ đọc (bỏ 0/O/1/I) */
export function newTxnCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint32Array(6));
  return 'MOT' + Array.from(r, (x) => A[x % A.length]).join('');
}

// Mã BIN (NAPAS) của các ngân hàng phổ biến — trường “Mã ngân hàng” trong Cài đặt nhận tên viết tắt hoặc BIN 6 số
export const BANK_BIN = {
  MB: '970422', MBBANK: '970422', VCB: '970436', VIETCOMBANK: '970436', TCB: '970407', TECHCOMBANK: '970407',
  ACB: '970416', BIDV: '970418', CTG: '970415', VIETINBANK: '970415', ICB: '970415', VPB: '970432', VPBANK: '970432',
  TPB: '970423', TPBANK: '970423', STB: '970403', SACOMBANK: '970403', VBA: '970405', AGRIBANK: '970405',
  HDB: '970437', HDBANK: '970437', VIB: '970441', SHB: '970443', MSB: '970426', OCB: '970448', SEAB: '970440',
  EIB: '970431', EXIMBANK: '970431', LPB: '970449', LPBANK: '970449', NAB: '970428', ABB: '970425', BAB: '970409',
  VCCB: '970454', PGB: '970430', CAKE: '546034', TIMO: '963388', UBANK: '546035', KLB: '970452', SCB: '970429', NCB: '970419',
};
export const bankBin = (id) => { const k = String(id || '').trim().toUpperCase(); return /^\d{6}$/.test(k) ? k : BANK_BIN[k] || ''; };

const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(s) {
  let c = 0xffff;
  for (const b of new TextEncoder().encode(s)) { c ^= b << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; }
  return c.toString(16).toUpperCase().padStart(4, '0');
}
/** Nội dung mã QR chuyển khoản theo chuẩn VietQR (NAPAS/EMVCo): ngân hàng + số TK + số tiền + nội dung */
export function vietQrPayload(bank, amount, info) {
  const bin = bankBin(bank && bank.bankId); const acc = String((bank && bank.number) || '').replace(/\s/g, '');
  if (!bin || !acc) return '';
  const amt = Math.max(0, Math.round(Number(amount) || 0));
  const note = String(info || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25);
  let p = tlv('00', '01') + tlv('01', amt ? '12' : '11')
    + tlv('38', tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', acc)) + tlv('02', 'QRIBFTTA'))
    + tlv('53', '704') + (amt ? tlv('54', String(amt)) : '') + tlv('58', 'VN') + (note ? tlv('62', tlv('08', note)) : '') + '6304';
  return p + crc16(p);
}

export const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
export const DEFAULT_PLAN = {
  name: 'Khóa học Mọt Tiếng Trung trọn bộ HSK1–6',
  price: 365000,
  months: 12,
  benefits: ['Trọn bộ HSK 1–6 chỉ 365K/năm (≈ 1K/ngày)', 'Mở toàn bộ lộ trình: bài giảng, từ vựng, luyện viết, nghe, ngữ pháp, luyện nói từng bài', 'Bài kiểm tra cuối chặng, lưu điểm và tiến độ cá nhân', 'Đề thi thử HSK 1–6, luyện gõ, shadowing, HSKK'],
};

// ----- Kênh hỗ trợ (Zalo / Facebook) -----
export const DEFAULT_SUPPORT = { zalo: '', facebook: '', messenger: '', hours: '8:00 – 22:00 hằng ngày', floating: true };
export const supportOf = (settings) => ({ ...DEFAULT_SUPPORT, ...((settings && settings.support) || {}) });
const isUrl = (v) => /^https?:\/\//i.test(v);
/** Số điện thoại hoặc link Zalo → link mở chat Zalo */
export const zaloUrl = (v) => { v = String(v || '').trim(); if (!v) return ''; if (isUrl(v)) return v; const d = v.replace(/\D/g, ''); return d ? 'https://zalo.me/' + d : ''; };
/** Tên trang / link Facebook → link Messenger (có thể kèm sẵn tin nhắn) */
export function messengerUrl(s, text) {
  let v = String(s.messenger || '').trim();
  if (!v) { const fb = String(s.facebook || '').trim(); const m = fb.match(/facebook\.com\/(?:profile\.php\?id=)?([^/?#]+)/i); v = m ? m[1] : isUrl(fb) ? '' : fb; }
  if (!v) return '';
  const base = isUrl(v) ? v : 'https://m.me/' + v.replace(/^@/, '');
  return text && /m\.me\//.test(base) ? base + (base.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text) : base;
}
export const facebookUrl = (v) => { v = String(v || '').trim(); return !v ? '' : isUrl(v) ? v : 'https://www.facebook.com/' + v.replace(/^@/, ''); };

// ----- Quà “Nhận ngay lộ trình”: khảo sát + nhiệm vụ (mở link là tính hoàn thành), lưu để thống kê -----
export const DEFAULT_GIFT = {
  file: '', // link file Lộ trình học tiếng Trung cho người mới
  tasks: [
    { k: 'fbPage', label: 'Theo dõi Page Facebook', url: '' },
    { k: 'fbGroup', label: 'Tham gia nhóm HỌC CÙNG MỌT TIẾNG TRUNG', url: '' },
    { k: 'zalo', label: 'Vào nhóm Zalo MỌT TIẾNG TRUNG', url: '' },
    { k: 'tiktok', label: 'Theo dõi TikTok', url: '' },
    { k: 'locket', label: 'Kết bạn Locket', url: '' },
    { k: 'share', label: 'Chia sẻ Mọt cho 1 người bạn muốn học tiếng Trung', url: '' },
  ],
};
export const GIFT_LEVELS = ['Chưa biết gì', 'Biết Pinyin', 'Đang học HSK 1–2', 'HSK 3 trở lên'];
export const GIFT_GOALS = ['Thi chứng chỉ HSK', 'Du học', 'Công việc', 'Giao tiếp', 'Sở thích'];
export const GIFT_TIMES = ['15 phút', '30 phút', '1 giờ', 'Trên 1 giờ'];
export const GIFT_SOURCES = ['Facebook', 'TikTok', 'Zalo', 'Bạn bè giới thiệu', 'Tìm kiếm Google', 'Khác'];
/** Nhiệm vụ đang bật: có link, hoặc là nhiệm vụ chia sẻ. Link trống lấy từ phần Hỗ trợ (Facebook, Zalo) nếu có. */
export function giftOf(settings) {
  const g = { ...DEFAULT_GIFT, ...((settings && settings.gift) || {}) };
  const sp = supportOf(settings);
  const fill = { fbPage: facebookUrl(sp.facebook), zalo: zaloUrl(sp.zalo) };
  const tasks = (g.tasks || []).map((t) => ({ ...t, url: t.url || (fill[t.k] || '') }));
  return { ...g, tasks, active: tasks.filter((t) => t.k === 'share' || t.url) };
}
