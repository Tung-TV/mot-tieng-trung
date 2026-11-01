// Cloudflare Pages Function: AI chấm phát âm câu nói của Học viên (miễn phí trong hạn mức Workers AI 10.000 neuron/ngày).
// POST /api/ai-speak  (multipart: audio = file WAV ≤ 15 giây, target = câu mẫu, pinyin, meaning)  · Authorization: Bearer <phiên Supabase>
// 1) Gọi hàm ai_take trong Supabase bằng phiên của người dùng → kiểm tra đúng là Học viên + trừ lượt trong ngày
// 2) Whisper nghe câu nói → chữ Hán   3) Qwen so với câu mẫu, nhận xét bằng tiếng Việt
const DAILY_LIMIT = 60;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const han = (s) => (s || '').replace(/[^一-鿿]/g, '');
function similarity(a, b) {
  const x = han(a), y = han(b); if (!x || !y) return 0;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return Math.max(0, Math.round((1 - d[x.length][y.length] / Math.max(x.length, y.length)) * 100));
}
// Whisper hay “bịa” mấy câu này khi bản ghi im lặng / chỉ có tiếng ồn → coi như không nghe được gì
const HALLU = /(点赞|订阅|转发|打赏|明镜|字幕|谢谢观看|感谢观看|请不吝|下次再见|中文字幕|以下是普通话)/;
// Workers AI có thể trả response là chuỗi, hoặc đã là object JSON
function pickReview(r) {
  const raw = r && (r.response !== undefined ? r.response : r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content);
  if (raw && typeof raw === 'object') return raw;
  const txt = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
const b64 = (buf) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) return json({ error: 'Máy chủ chưa bật Workers AI (binding “AI”).' }, 503);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+/.test(auth)) return json({ error: 'Bạn cần đăng nhập tài khoản Học viên.' }, 401);
    // kiểm tra quyền + hạn mức bằng chính phiên của người dùng (RLS / security definer trong database)
    const q = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/ai_take', { method: 'POST', headers: { apikey: env.SUPABASE_ANON_KEY, authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify({ p_limit: DAILY_LIMIT }) });
    const qj = await q.json().catch(() => ({}));
    if (!q.ok) return json({ error: qj.message || 'Chấm bằng AI dành cho Học viên.' }, 403);
    const left = typeof qj === 'number' ? qj : null;

    const form = await request.formData();
    const audio = form.get('audio'), target = String(form.get('target') || '').slice(0, 200);
    const pinyin = String(form.get('pinyin') || '').slice(0, 300), meaning = String(form.get('meaning') || '').slice(0, 300);
    if (!audio || typeof audio === 'string' || !target) return json({ error: 'Thiếu bản ghi hoặc câu mẫu.' }, 400);
    if (audio.size > 1_000_000) return json({ error: 'Bản ghi quá dài, hãy nói trong 15 giây.' }, 413);

    const asr = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: b64(await audio.arrayBuffer()), language: 'zh', initial_prompt: '以下是普通话的句子。' });
    let heard = String((asr && asr.text) || '').trim();
    if (HALLU.test(heard) && !HALLU.test(target)) heard = '';
    const score = similarity(heard, target);

    let review = null;
    if (heard) {
      const prompt = `Bạn là giáo viên tiếng Trung cho người Việt. Học viên đọc câu mẫu, máy nhận giọng nói ghi lại được câu bên dưới.
Câu mẫu: ${target}${pinyin ? '\nPinyin: ' + pinyin : ''}${meaning ? '\nNghĩa: ' + meaning : ''}
Máy nghe được: ${heard}
Hãy so sánh từng chữ. Chữ bị nghe khác thường do phát âm sai thanh mẫu, vận mẫu hoặc thanh điệu. Trả lời DUY NHẤT một JSON (không thêm chữ nào khác) dạng:
{"score": số 0-100, "mistakes": [{"want": "chữ đúng (pinyin)", "got": "chữ máy nghe được (pinyin)", "note": "lỗi phát âm có thể gặp, tiếng Việt, ngắn"}], "comment": "nhận xét chung 1-2 câu tiếng Việt, thân thiện", "tip": "1 mẹo luyện cụ thể bằng tiếng Việt"}
Nếu đọc đúng hết thì mistakes là mảng rỗng.`;
      const r = await env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', { messages: [{ role: 'system', content: 'Chỉ trả lời bằng JSON hợp lệ. /no_think' }, { role: 'user', content: prompt }], max_tokens: 600, temperature: 0.2 });
      review = pickReview(r);
      if (!review) console.log('ai-speak: không đọc được nhận xét', JSON.stringify(r).slice(0, 300));
    }
    return json({
      heard, score: review && Number.isFinite(+review.score) ? Math.round((+review.score + score) / 2) : score,
      mistakes: (review && Array.isArray(review.mistakes) ? review.mistakes : []).slice(0, 8),
      comment: (review && review.comment) || (heard ? '' : 'Mọt chưa nghe rõ, bạn nói to và gần micro hơn nhé.'),
      tip: (review && review.tip) || '', left,
    });
  } catch (e) {
    return json({ error: 'AI đang bận, bạn thử lại sau ít phút nhé.', detail: String(e && e.message || e).slice(0, 200) }, 500);
  }
}
