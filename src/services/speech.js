// Đọc tiếng Trung bằng giọng có sẵn của thiết bị + nhận giọng nói (miễn phí, chạy trong trình duyệt)
let voice = null;
function pickVoice() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  let best = -1; voice = null;
  vs.forEach((v) => {
    const l = v.lang || '', n = v.name || '';
    let sc = /^zh[-_]?(CN|Hans)/i.test(l) || /^cmn/i.test(l) ? 50 : /^zh/i.test(l) ? 20 : -1;
    if (sc < 0) return;
    if (/natural|neural|online|xiao|yun|google|普通话|mandarin/i.test(n)) sc += 30;
    if (/hk|hong|tw|taiwan|yue|cantonese|粤|台/i.test(n + l)) sc -= 45;
    if (sc > best) { best = sc; voice = v; }
  });
}
if (typeof window !== 'undefined' && window.speechSynthesis) speechSynthesis.onvoiceschanged = pickVoice;

export const canSpeak = () => typeof window !== 'undefined' && !!window.speechSynthesis;
export function say(text, rate = 0.8) {
  if (!canSpeak() || !text) return false;
  pickVoice(); speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; if (voice) u.voice = voice; u.rate = rate;
  speechSynthesis.speak(u); return true;
}
export const stopSay = () => { try { speechSynthesis.cancel(); } catch { /* */ } };

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
export const canListen = () => !!SR;
const han = (s) => (s || '').replace(/[^一-鿿]/g, '');
/** Độ giống (0–100) giữa câu nói nhận được và câu mẫu, so theo chữ Hán */
export function similarity(a, b) {
  const x = han(a), y = han(b);
  if (!x || !y) return 0;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return Math.max(0, Math.round((1 - d[x.length][y.length] / Math.max(x.length, y.length)) * 100));
}
/** Nghe người dùng nói (zh-CN). Trả về Promise<{ text, score }> */
export function listen(target) {
  return new Promise((resolve, reject) => {
    if (!SR) { reject(new Error('Trình duyệt này chưa hỗ trợ nhận giọng nói (hãy dùng Chrome hoặc Edge).')); return; }
    const r = new SR(); let got = false;
    r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 3;
    r.onresult = (e) => {
      got = true; let best = { text: '', score: -1 };
      for (let i = 0; i < e.results[0].length; i++) { const t = e.results[0][i].transcript, s = similarity(t, target); if (s > best.score) best = { text: t, score: s }; }
      resolve(best);
    };
    r.onerror = (e) => { if (!got) reject(new Error(e.error === 'not-allowed' ? 'Hãy cho phép trình duyệt dùng micro.' : 'Không nghe rõ, bạn thử lại nhé.')); };
    r.onend = () => { if (!got) reject(new Error('Không nghe rõ, bạn thử lại nhé.')); };
    try { r.start(); } catch { reject(new Error('Không mở được micro.')); }
  });
}
