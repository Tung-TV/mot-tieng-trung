// Chuyển dữ liệu thô trích từ HTML gốc (seed.json) sang mô hình dữ liệu của app
import raw from '../data/seed.json';

export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const ARTKIND = ['book', 'slide', 'kids', 'sheet', 'radical', 'grid', 'exam', 'doc', 'letter'];
export { ARTKIND };

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
  }));
  return {
    version: 1,
    documents,
    stages,
    settings: {
      bank: { ...raw.BANK },
      affiliate: { ...raw.AFF },
      tools: raw.TOOLS,
      apps: raw.APPS,
      prompts: raw.PR,
      chipColors: raw.CC,
      chipEmojis: raw.CE,
      images: raw.IMGS,
    },
  };
}
