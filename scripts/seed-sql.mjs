// Sinh docs/seed.sql (dữ liệu ban đầu cho Supabase) từ src/services/seed.js. Dùng: node scripts/seed-sql.mjs > docs/seed.sql
import { build } from 'esbuild';
const r = await build({ entryPoints: [new URL('../src/services/seed.js', import.meta.url).pathname], bundle: true, format: 'esm', write: false, platform: 'node' });
const mod = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
const s = mod.buildSeed();
const rows = [
  ...s.documents.map((d) => [d.id, 'document', -(d.createdAt || 0), d]),
  ...s.stages.map((x, i) => [x.id, 'stage', i, { ...x, order: i }]),
  ['settings', 'settings', 0, s.settings],
];
const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
let sql = '-- Dữ liệu ban đầu (40 tài liệu, 9 chặng, cài đặt). Chỉ thêm khi bảng content còn trống.\ninsert into public.content (id, kind, sort, data)\nselect * from (values\n' +
  rows.map((r) => `  (${q(r[0])}, ${q(r[1])}, ${r[2]}::bigint, ${q(JSON.stringify(r[3]))}::jsonb)`).join(',\n') +
  '\n) as v(id, kind, sort, data)\nwhere not exists (select 1 from public.content);\n';
process.stdout.write(sql);
