// Điểm vào duy nhất cho dữ liệu. Đổi backend bằng biến môi trường VITE_BACKEND.
import { createLocalAdapter } from './localAdapter.js';
import { createSupabaseAdapter } from './supabaseAdapter.js';

const env = (import.meta && import.meta.env) || {};
const backend = env.VITE_BACKEND || 'local';

export const store = backend === 'supabase'
  ? createSupabaseAdapter(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : createLocalAdapter({ googleClientId: env.VITE_GOOGLE_CLIENT_ID || '' });
