// Xuất dữ liệu bài học HSK1–6 từ bản HTML gốc → public/data/lessons/<cấp>.json (để nạp vào CMS)
// Dùng: NODE_PATH=... node scripts/legacy/genlessons.cjs <thư mục x chứa s2.js> public/data/lessons
const fs = require('fs'), acorn = require('acorn'), vm = require('vm'), path = require('path');
const [, , xdir, out] = process.argv;
const s = fs.readFileSync(path.join(xdir, 's2.js'), 'utf8');
const ast = acorn.parse(s, { ecmaVersion: 'latest' });
const CTX = {};
const get = (name) => { for (const st of ast.body) if (st.type === 'VariableDeclaration') for (const d of st.declarations) if (d.id.name === name && d.init) return vm.runInNewContext('(' + s.slice(d.init.start, d.init.end) + ')', CTX); };
CTX.AFFU = get('AFFU');
const ST = get('ST'), LSB = get('LSB');
const LSK = [null, get('LSK'), get('LSK2'), get('LSK3'), get('LSK4'), get('LSK5'), get('LSK6')];
const WL1 = get('WLS'); const WLS = [null, WL1, get('WLS2'), get('WLS3'), get('WLS4'), get('WLS5'), get('WLS6')];
const VC1 = get('VCW'); const VCW = [null, VC1, get('VCW2'), get('VCW3'), get('VCW4'), get('VCW5'), get('VCW6')];
const GR = [null, get('GMD'), get('GMD2'), get('GMD3'), get('G4D'), get('G5D'), get('G6D')];
const vurl = (lv, id) => (/^https?:/.test(id) ? id : lv > 3 ? 'https://youtu.be/' + id : LSB + id);
const normQuiz = (q) => {
  if (q.k === 'c') return { type: 'choice', q: q.q, o: q.o, a: q.a, why: q.w || '' };
  if (q.k === 'o') return { type: 'order', q: q.q, w: q.w, h: q.h || '' };
  if (q.s && q.a) { const o = [q.a[0], ...(q.d || [])]; return { type: 'choice', q: q.s, o, a: 0, why: '' }; }
  return null;
};
const normG = (g) => (g.rule !== undefined || g.ex ? { t: g.t, e: g.e || '', rule: g.rule || '', note: g.note || '', ex: (g.ex || []).map((x) => (x.length === 3 ? x : [x[0], '', x[1]])), tip: g.tip || '' }
  : { t: g.t, e: '', rule: '', note: g.r || '', ex: (g.x || []).map((x) => (x.length === 3 ? x : [x[0], '', x[1]])), tip: '' });
fs.mkdirSync(out, { recursive: true });
for (let lv = 1; lv <= 6; lv++) {
  const st = ST[lv + 1], list = [];
  (st.lessons || []).forEach((l, i) => {
    const n = i + 1, G = GR[lv][n] || {};
    const vocab = (VCW[lv][n] || []).map((w) => ({ h: w.h, p: w.p, t: w.t || '', m: w.m || '', e: w.e || [] }));
    const grammar = (G.g || []).map(normG);
    const quiz = (G.q || []).map(normQuiz).filter(Boolean);
    let speak = grammar.flatMap((g) => g.ex).filter((x) => x[1]).slice(0, 8);
    if (speak.length < 4) speak = speak.concat(vocab.flatMap((w) => w.e).filter((x) => x[1]).slice(0, 8 - speak.length));
    list.push({
      id: lv + '-' + n, level: lv, n, title: l[0], vi: l[1], free: n === 1,
      videos: (LSK[lv][n] || []).map((id, k, a) => ({ title: a.length > 1 ? 'Phần ' + (k + 1) : 'Video bài giảng', url: vurl(lv, id) })),
      vocab, write: WLS[lv][n] || '', grammar, quiz, speak,
    });
  });
  fs.writeFileSync(path.join(out, lv + '.json'), JSON.stringify(list));
  console.log('HSK' + lv, list.length, 'bài', Math.round(fs.statSync(path.join(out, lv + '.json')).size / 1024) + 'KB');
}
