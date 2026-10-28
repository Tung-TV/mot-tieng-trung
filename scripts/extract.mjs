// Trích dữ liệu + ảnh + CSS từ file HTML gốc
import fs from 'node:fs'; import vm from 'node:vm'; import path from 'node:path';
const src = process.argv[2], out = process.argv[3];
const html = fs.readFileSync(src, 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
fs.writeFileSync(path.join(out, 'src/styles/legacy.css'), css.trim() + '\n');
// ảnh trong phần markup
const saveImg = (dataUri, name) => { const m = dataUri.match(/^data:image\/(\w+);base64,(.*)$/); const ext = m[1] === 'jpeg' ? 'jpg' : m[1]; const f = `${name}.${ext}`; fs.writeFileSync(path.join(out, 'public/assets', f), Buffer.from(m[2], 'base64')); return `assets/${f}`; };
const imgs = {};
imgs.logo = saveImg(html.match(/class="brand"[^>]*><img src="([^"]+)"/)[1], 'logo');
imgs.banner = saveImg(html.match(/class="banner"[^>]*><img src="([^"]+)"/)[1], 'banner');
['n1','n2','n3','n4'].forEach((n, i) => { const re = new RegExp(`class="nv ${n}"[\\s\\S]*?<img src="([^"]+)"`); imgs['nav' + (i + 1)] = saveImg(html.match(re)[1], 'nav-' + (i + 1)); });
// chạy script với DOM giả để lấy biến
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const el = () => new Proxy(function(){}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : (k === 'files' ? [] : el()), set: () => true, apply: () => el() });
const ctx = { document: { getElementById: el, querySelectorAll: () => [], querySelector: el, addEventListener(){}, createElement: el, body: el() }, window: { addEventListener(){} }, location: { hash: '' }, navigator: {}, localStorage: { getItem(){}, setItem(){} }, Image: function(){ return el(); }, FileReader: function(){}, setTimeout(){}, console };
vm.createContext(ctx);
vm.runInContext(js + ';globalThis.__D={AFF,BANK,DOCS,DL,ARTS,ST,TOOLS,APPS,PR,CC,CE,KWS,LAB}', ctx);
const D = JSON.parse(JSON.stringify(ctx.__D));
const imgDir = path.join(out, 'public/assets');
D.BANK.qr = saveImg(D.BANK.qr, 'qr-bank');
D.TOOLS.forEach(t => { t.img = saveImg(t.img, 'tool-' + t.k); });
D.ST.forEach((s, i) => { if (s.cover) s.cover = saveImg(s.cover, 'cover-stage-' + i); });
// ảnh nhúng trong nội dung App (HTML)
let n = 0; D.APPS.forEach(a => { a.h = a.h.replace(/src="(data:image\/[^"]+)"/g, (_, d) => `src="${saveImg(d, 'app-' + (n++))}"`); });
D.IMGS = imgs;
fs.writeFileSync(path.join(out, 'src/data/seed.json'), JSON.stringify(D, null, 1));
console.log('docs', D.DOCS.length, 'stages', D.ST.length, 'tools', D.TOOLS.length, 'apps', D.APPS.length, 'imgs', fs.readdirSync(imgDir).length);
