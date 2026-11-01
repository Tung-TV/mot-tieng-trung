// Chuyển dữ liệu thô trích từ HTML gốc (seed.json) sang mô hình dữ liệu của app
import raw from '../data/seed.json';
import { DEFAULT_PLAN, DEFAULT_SUPPORT, starterTest, testFromLessons } from './model.js';

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const ARTKIND = ['book', 'slide', 'kids', 'sheet', 'radical', 'grid', 'exam', 'doc', 'letter'];
export { ARTKIND };

// thêm câu tự luận / nói vào bài mẫu để minh hoạ phần chấm tay
const SAMPLE_EXTRA = {
  'Vỡ lòng': { write: 'Viết 2 câu tự giới thiệu bằng chữ Hán (tên, bạn là người nước nào).' },
  'Tập sự': { speak: 'Đọc to: 我们去机场接你们。你们几点到？' },
};

export function buildSeed() {
  const now = Date.now();
  const documents = raw.DOCS.map((d, i) => {
    const a = raw.ARTS[i] || ['book', d.f, '', '学', '#3b82d6'];
    return {
      id: 'doc_' + (i + 1),
      name: d.n,
      format: d.f,
      url: d.u,
      downloads: raw.DL[i] || 0,
      art: { kind: a[0], l1: a[1], l2: a[2], ch: a[3], color: a[4] },
      published: true,
      // giữ thứ tự gốc cho "Mới nhất"
      createdAt: now - i * 60000,
    };
  });
  const stages = raw.ST.map((s, i) => ({
    id: 'stage_' + (i + 1),
    order: i,
    key: s.k,
    emoji: s.e || (raw.LAB[i] && raw.LAB[i][0]) || '📘',
    color: s.c,
    whiteText: !!s.w,
    title: s.t,
    badge: s.b,
    desc: s.d,
    chips: s.ch || [],
    keyword: raw.KWS[s.tab] ?? '',
    sections: (s.it || []).map((x) => ({ title: x.t, color: x.c, items: x.l, note: x.n || '' })),
    info: s.info || [],
    lessons: s.lessons || [],
    ribbon: s.rib || '',
    ribbonColor: s.rc || '',
    affKey: s.aff || '',
    cover: s.cover || '',
    boxes: s.bx || [],
    soon: !!s.soon,
    // vào học miễn phí: chặng Bắt đầu, Nhập môn; bài 1 mỗi cấp HSK cho học thử (admin đổi được)
    free: i < 2,
    freeLessons: /^HSK[1-6]$/.test(s.t) ? [1] : [],
    // “Nhập môn” hoàn thành bằng nút; các chặng khác phải qua bài kiểm tra (admin soạn trong CMS)
    completion: s.k === 'Nhập môn' ? 'button' : 'test',
    // bài kiểm tra mẫu tạo từ danh sách bài học (HSK1–3); chặng khác admin tự soạn
    test: i === 0 ? starterTest(raw.TOOLS) : testFromLessons(s.lessons || [], 8, SAMPLE_EXTRA[s.k] || {}),
  }));
  return {
    version: 2,
    documents,
    stages,
    settings: {
      bank: { bankId: 'MB', ...raw.BANK },
      plan: { ...DEFAULT_PLAN },
      support: { ...DEFAULT_SUPPORT },
      affiliate: { ...raw.AFF },
      tools: raw.TOOLS,
      apps: raw.APPS,
      prompts: raw.PR,
      chipColors: raw.CC,
      chipEmojis: raw.CE,
      images: raw.IMGS,
      contentRev: 3,
    },
  };
}

// ----- Cập nhật nội dung theo bản HTML mới (rev 2: lộ trình HSK1–6 đủ bài học, khoá học 365K/năm, kho 62 tài liệu) -----
export const CONTENT_REV = 3;
const STAGE_FIELDS = ['title', 'desc', 'chips', 'sections', 'info', 'lessons', 'ribbon', 'ribbonColor', 'affKey', 'cover', 'soon', 'boxes'];
// trường chỉ thêm khi chặng chưa có (không đè cấu hình admin)
const STAGE_DEFAULTS = ['free', 'freeLessons'];

/** Tính phần thay đổi so với dữ liệu hiện có. Giữ nguyên bài kiểm tra, cách hoàn thành và tài liệu admin đã sửa. */
export function contentUpdate(content) {
  const fresh = buildSeed();
  const stages = [];
  fresh.stages.forEach((f) => {
    const cur = content.stages.find((s) => s.id === f.id);
    if (!cur) { stages.push(f); return; }
    const next = { ...cur };
    STAGE_FIELDS.forEach((k) => { next[k] = f[k]; });
    STAGE_DEFAULTS.forEach((k) => { if (cur[k] === undefined) next[k] = f[k]; });
    // chặng chưa có câu hỏi nào → dùng bài mẫu tạo từ danh sách bài học mới
    const nq = (t) => ((t && t.sections) || []).reduce((n, x) => n + (x.questions || []).length, 0);
    if (!nq(cur.test) && nq(f.test)) next.test = f.test;
    if (JSON.stringify(next) !== JSON.stringify(cur)) stages.push(next);
  });
  const names = new Set(content.documents.map((d) => d.name.trim().toLowerCase()));
  const documents = fresh.documents.filter((d) => !names.has(d.name.trim().toLowerCase())).map((d) => ({ ...d, id: uid('doc'), createdAt: Date.now() }));
  const s = content.settings;
  const oldPlan = !s.plan || (s.plan.price === 199000 && !s.plan.months);
  const settings = {
    ...s,
    affiliate: { ...(s.affiliate || {}), ...fresh.settings.affiliate },
    tools: fresh.settings.tools,
    apps: fresh.settings.apps,
    chipColors: fresh.settings.chipColors,
    chipEmojis: fresh.settings.chipEmojis,
    plan: oldPlan ? { ...fresh.settings.plan } : s.plan,
    contentRev: CONTENT_REV,
  };
  return { stages, documents, settings, planChanged: oldPlan };
}
