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

// ---------- Ghi âm ngắn → WAV 16 kHz mono (gửi AI chấm phát âm) ----------
export const canRecord = () => typeof window !== 'undefined' && !!(navigator.mediaDevices && window.MediaRecorder);
function toWav(buf) {
  const ch = buf.getChannelData(0), n = ch.length, out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, ch[i])); out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true); }
  return new Blob([out], { type: 'audio/wav' });
}
/** Bắt đầu ghi; trả về { stop(): Promise<Blob wav> }. Tự dừng sau maxSec giây (onAuto được gọi khi tự dừng). */
export async function startRecording(maxSec = 12, onAuto) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  const mr = new MediaRecorder(stream), chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let done;
  const finished = new Promise((res) => { mr.onstop = res; });
  const stop = () => {
    if (!done) done = (async () => {
      if (mr.state !== 'inactive') mr.stop();
      await finished; stream.getTracks().forEach((t) => t.stop());
      const raw = await new Blob(chunks).arrayBuffer();
      const AC = window.AudioContext || window.webkitAudioContext, ac = new AC();
      const dec = await ac.decodeAudioData(raw); ac.close();
      const len = Math.ceil(dec.duration * 16000), off = new OfflineAudioContext(1, Math.max(1, len), 16000);
      const src = off.createBufferSource(); src.buffer = dec; src.connect(off.destination); src.start();
      return toWav(await off.startRendering());
    })();
    return done;
  };
  mr.start();
  const t = setTimeout(() => { if (onAuto) onAuto(); }, maxSec * 1000);
  return { stop: () => { clearTimeout(t); return stop(); } };
}
