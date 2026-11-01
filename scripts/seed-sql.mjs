// Sinh docs/seed.sql (dữ liệu ban đầu cho Supabase, đúng định dạng tách công khai / học viên / đáp án).
// Dùng: node scripts/seed-sql.mjs > docs/seed.sql
import { build } from 'esbuild';

const src = (p) => new URL(p, import.meta.url).pathname;
const load = async (entry) => {
  const r = await build({ entryPoints: [src(entry)], bundle: true, format: 'esm', write: false, platform: 'node' });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
};
const { buildSeed } = await load('../src/services/seed.js');
const { splitStage, splitSettings } = await load('../src/services/model.js');

const s = buildSeed();
const rows = [];
s.documents.forEach((d) => rows.push([d.id, 'document', -d.createdAt, d]));
s.stages.forEach((st, i) => {
  const { pub, detail, key } = splitStage({ ...st, order: i });
  rows.push([st.id, 'stage', i, pub], ['sd:' + st.id, 'stage_detail', i, detail]);
  if (key) rows.push(['tk:' + st.id, 'test_key', i, { id: st.id, ...key }]);
});
const { pub, premium } = splitSettings(s.settings);
rows.push(['settings', 'settings', 0, pub], ['premium', 'premium', 0, premium]);

const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
process.stdout.write('-- Dữ liệu ban đầu (40 tài liệu, 9 chặng kèm bài kiểm tra, cài đặt). Chạy sau supabase.sql + migrations/002.\n'
  + '-- Chỉ thêm khi bảng content còn trống.\ninsert into public.content (id, kind, sort, data)\nselect * from (values\n'
  + rows.map((r) => `  (${q(r[0])}, ${q(r[1])}, ${r[2]}::bigint, ${q(JSON.stringify(r[3]))}::jsonb)`).join(',\n')
  + '\n) as v(id, kind, sort, data)\nwhere not exists (select 1 from public.content);\n');
