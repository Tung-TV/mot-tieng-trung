import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, existsSync } from 'node:fs';

// Cloudflare Pages: nhánh khác "main" (bản xem trước) chạy chế độ lưu trên trình duyệt với dữ liệu mẫu,
// để thử tính năng mới mà KHÔNG đụng vào database thật. Chỉ nhánh main dùng Supabase.
const branch = process.env.CF_PAGES_BRANCH;
const preview = !!branch && branch !== 'main';
if (preview) process.env.VITE_BACKEND = 'local';

// bản xem trước cần kèm dữ liệu bài học (bản thật thì admin nhập vào CMS, không để công khai)
const copyLessons = () => ({
  name: 'copy-lessons',
  closeBundle() { if (preview && existsSync('data/lessons')) cpSync('data/lessons', 'dist/data/lessons', { recursive: true }); },
});

// Bản local (npm run dev): sổ phiên đăng nhập dùng chung cho mọi trình duyệt mở cùng máy chủ dev, để thử
// "mỗi tài khoản 1 thiết bị" (src/services/localAdapter.js › checkSession). POST {email, sid} = đăng ký phiên
// mới nhất, POST {email} = hỏi phiên mới nhất. Chỉ nằm trong bộ nhớ, tắt máy chủ là mất.
const devSessions = () => {
  const latest = new Map();
  return {
    name: 'mot-dev-sessions',
    configureServer(server) {
      server.middlewares.use('/__mot/session', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          let b = {}; try { b = JSON.parse(raw || '{}'); } catch { /* */ }
          const email = String(b.email || '').toLowerCase().trim();
          if (email && b.sid) latest.set(email, String(b.sid));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ sid: latest.get(email) || null }));
        });
      });
    },
  };
};

// base './' để chạy được trên GitHub Pages / thư mục con
export default defineConfig({ plugins: [react(), copyLessons(), devSessions()], base: './' });
