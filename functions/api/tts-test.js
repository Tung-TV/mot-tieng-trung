// Tạm thời: tạo thử giọng MeloTTS để nghe (nhánh tts-test, xoá sau khi nghe xong)
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const text = (u.searchParams.get('t') || '你好').slice(0, 80);
  const lang = (u.searchParams.get('lang') || 'zh').slice(0, 5);
  try {
    const r = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang });
    const b64 = r && (r.audio || r);
    if (typeof b64 !== 'string') return new Response(JSON.stringify(r).slice(0, 500), { status: 500 });
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { 'content-type': 'audio/mpeg' } });
  } catch (e) { return new Response('ERR ' + e.message, { status: 500 }); }
}
