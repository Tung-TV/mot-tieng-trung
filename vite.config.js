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

// base './' để chạy được trên GitHub Pages / thư mục con
export default defineConfig({ plugins: [react(), copyLessons()], base: './' });
