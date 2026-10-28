// Build dự phòng bằng esbuild (dùng khi không cài được Vite). Kết quả giống `npm run build`: thư mục dist/
// Dùng: node scripts/build.mjs [--backend=supabase]
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

// Đọc .env (đơn giản) để lấy biến VITE_*
const env = {};
const envFile = join(root, '.env');
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
for (const a of process.argv.slice(2)) { const m = a.match(/^--backend=(\w+)/); if (m) env.VITE_BACKEND = m[1]; }

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

await build({
  entryPoints: [join(root, 'src/main.jsx')],
  bundle: true, minify: true, format: 'esm', target: 'es2020',
  outfile: join(dist, 'app.js'),
  jsx: 'automatic',
  define: { 'import.meta.env': JSON.stringify({ MODE: 'production', ...env }), 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

const html = readFileSync(join(root, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.jsx"></script>', '<script type="module" src="app.js"></script>')
  .replace('</head>', '  <link rel="stylesheet" href="app.css">\n</head>');
writeFileSync(join(dist, 'index.html'), html);
console.log('✓ Build xong → dist/');
