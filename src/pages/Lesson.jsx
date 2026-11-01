// Trang bài học của Khoá học: video bài giảng ghim ở giữa, phần ôn tập bên dưới, nhớ chỗ đang học dở
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { navigate } from '../router.jsx';
import { canOpenLesson, lessonState, stageLevel } from '../services/model.js';
import { stopSay } from '../services/speech.js';
import { GrammarPart, ListenPart, SpeakPart, VocabPart, WritePart } from '../components/LessonParts.jsx';
import { UpgradeGate } from './StageDetail.jsx';

export const TABS = [['write', '✍️', 'Luyện viết', '#f0a860'], ['vocab', '📚', 'Từ vựng', '#a9c06a'], ['listen', '🎧', 'Nghe hiểu', '#b79ae0'], ['grammar', '🧩', 'Ngữ pháp', '#ef8c7e'], ['speak', '🗣️', 'Luyện nói', '#f2a65a']];

/** Mã video YouTube từ link (youtu.be/…, watch?v=…, embed/…, shorts/…) hoặc mã trần 11 ký tự */
export function ytId(u) {
  if (!u) return '';
  if (/^[\w-]{11}$/.test(u)) return u;
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/.exec(u);
  return m ? m[1] : '';
}

function Video({ videos, part, setPart, startAt, onTime }) {
  const v = videos[part] || videos[0];
  const id = ytId(v && v.url);
  const frame = useRef(null), slot = useRef(null), cur = useRef(startAt || 0);
  const [docked, setDocked] = useState(false);
  const [pin, setPin] = useState(true);
  // YouTube nhúng thẳng bằng iframe; nhận giây đang xem qua postMessage (không cần tải thêm thư viện)
  useEffect(() => {
    if (!id) return undefined;
    cur.current = startAt || 0;
    let last = 0;
    const onMsg = (e) => {
      if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname) || !frame.current || e.source !== frame.current.contentWindow) return;
      let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
      const info = d && d.info; if (!info) return;
      if (typeof info.currentTime === 'number') cur.current = info.currentTime;
      if (info.playerState === 0) onTime(cur.current, true);
      else if (info.playerState === 2 || Date.now() - last > 15000) { last = Date.now(); if (cur.current > 0) onTime(cur.current, false); }
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('message', onMsg); if (cur.current > 0) onTime(cur.current, false); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const listen = () => { try { frame.current.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch { /* */ } };
  // cuộn xuống phần ôn tập: video thu nhỏ, ghim ở góc để vừa xem vừa luyện
  useEffect(() => {
    if (!slot.current || !id) return undefined;
    const io = new IntersectionObserver(([e]) => setDocked(!e.isIntersecting), { threshold: 0.25 });
    io.observe(slot.current); return () => io.disconnect();
  }, [id]);

  if (!videos.length) return <div className="lsn-soon"><span className="em">🎬</span>Mọt đang cập nhật video bài giảng này.</div>;
  const src = id && 'https://www.youtube.com/embed/' + id + '?enablejsapi=1&rel=0&playsinline=1&modestbranding=1' + (startAt > 5 ? '&start=' + Math.floor(startAt) : '') + '&origin=' + encodeURIComponent(location.origin);
  return (
    <section className="lv-wrap">
      {videos.length > 1 && <div className="lv-parts">{videos.map((x, i) => <button key={i} type="button" className={i === part ? 'on' : ''} onClick={() => setPart(i)}>{x.title || 'Phần ' + (i + 1)}</button>)}</div>}
      {id ? (
        <>
          <div className="lv-slot yt" ref={slot}>
            <div className={'lv-player' + (docked && pin ? ' docked' : '')}>
              <iframe ref={frame} key={id} className="lv-frame" src={src} title={v.title || 'Video bài giảng'} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" onLoad={listen} />
              {docked && pin && <button type="button" className="lv-unpin" onClick={() => setPin(false)} aria-label="Bỏ ghim video">✕</button>}
            </div>
          </div>
          <div className="lv-sub">
            <a href={'https://www.youtube.com/watch?v=' + id + (cur.current > 5 ? '&t=' + Math.floor(cur.current) + 's' : '')} target="_blank" rel="noopener noreferrer">Không xem được? Mở trên YouTube ↗</a>
            {!pin && <button type="button" className="btn-s small" onClick={() => setPin(true)}>📌 Ghim video khi cuộn</button>}
          </div>
        </>
      ) : (
        <a className="btn-p lv-open" href={v.url} target="_blank" rel="noopener noreferrer" onClick={() => onTime(1, false)}>▶ Mở video bài giảng{videos.length > 1 ? ' · ' + (v.title || 'Phần ' + (part + 1)) : ''}</a>
      )}
    </section>
  );
}

export default function Lesson({ lv, n }) {
  const { store, content, tier, progress, setProgress, user, toast } = useApp();
  const stage = content.stages.find((s) => stageLevel(s) === lv);
  const id = lv + '-' + n;
  const [l, setL] = useState(null);
  const [err, setErr] = useState('');
  const progRef = useRef(progress); progRef.current = progress;
  const rec = (progress.lessons || {})[id] || {};
  const [tab, setTab0] = useState(rec.tab || 'vocab');
  const [part, setPart0] = useState(rec.vi || 0);
  const allowed = stage && canOpenLesson(stage, n, tier);

  const save = useCallback((patch) => {
    const p = progRef.current, cur = (p.lessons || {})[id] || {};
    const next = { ...cur, ...patch, at: Date.now() };
    if (cur.s === 'done' && patch.s === 'doing') next.s = 'done';
    setProgress({ lessons: { ...(p.lessons || {}), [id]: next }, lastLesson: id });
  }, [id, setProgress]);

  useEffect(() => {
    if (!allowed) return undefined;
    let alive = true; setL(null); setErr('');
    store.getLesson(lv, n).then((x) => { if (alive) { setL(x); } }, (e) => alive && setErr(e.message));
    const r = (progRef.current.lessons || {})[id] || {};
    setTab0(r.tab || 'vocab'); setPart0(r.vi || 0);
    return () => { alive = false; stopSay(); };
  }, [lv, n, allowed, store, id]);
  // mở bài lần đầu → “Đang học”
  useEffect(() => { if (l && lessonState(progRef.current, id) === 'new') save({ s: 'doing' }); }, [l, id, save]);

  if (!stage) return <section className="sk soon"><div className="soon-e">🔍</div><h2>Không tìm thấy bài học</h2><div className="soon-a"><button className="btn-p" type="button" onClick={() => navigate('/lo-trinh')}>Về lộ trình</button></div></section>;
  if (!allowed) return <UpgradeGate title="Bài học dành cho Học viên Khoá học" />;
  const total = (stage.lessons || []).length;
  const title = (stage.lessons[n - 1] || [])[0] || (l && l.title) || '';
  const vi = (stage.lessons[n - 1] || [])[1] || (l && l.vi) || '';
  const st = lessonState(progress, id);
  const setTab = (t) => { setTab0(t); save({ tab: t }); };
  const setPart = (i) => { setPart0(i); save({ vi: i, t: 0 }); };
  const onTime = (t, ended) => save({ t: Math.floor(t || 0), vi: part, ...(ended ? { watched: true } : {}) });
  const go = (k) => { if (k >= 1 && k <= total) navigate('/bai-hoc/' + lv + '/' + k); };
  const nextOpen = n < total && canOpenLesson(stage, n + 1, tier);

  return (
    <div className="lsn2">
      <nav className="sd-nav">
        <button className="back" type="button" onClick={() => navigate('/lo-trinh/' + stage.id)}>‹ {stage.title} · {stage.key}</button>
        <span className="muted">Bài {n}/{total}</span>
      </nav>
      <header className="lsn2-h">
        <span className="lsn-n">Bài {n}</span>
        <div><h1 lang="zh">{title}</h1><p>{vi} · {stage.title}</p></div>
        <span className={'ls-st st-' + st}>{st === 'done' ? '✓ Đã học xong' : '▶ Đang học'}</span>
      </header>
      {!user && <p className="note-box">Bạn đang học thử. <b>Đăng nhập</b> để lưu tiến độ trên mọi thiết bị.</p>}

      {err ? <section className="sk soon"><div className="soon-e">📭</div><h2>{err}</h2></section> : !l ? <div className="lg-load"><span className="spin" />Đang tải bài học…</div> : (
        <>
          <Video key={id} videos={l.videos || []} part={Math.min(part, Math.max(0, (l.videos || []).length - 1))} setPart={setPart} startAt={rec.vi === part ? rec.t : 0} onTime={onTime} />
          <section className="sk ot2">
            <h2 className="ot2-h">📝 Ôn tập bài {n}</h2>
            <div className="lsn-t" role="tablist">
              {TABS.map(([k, e, t, c]) => <button key={k} type="button" role="tab" aria-selected={tab === k} style={{ '--c': c }} onClick={() => setTab(k)}>{e} {t}</button>)}
            </div>
            <div className="lsn-p" role="tabpanel">
              {tab === 'write' && <WritePart lesson={l} vocab={l.vocab || []} />}
              {tab === 'vocab' && <VocabPart vocab={l.vocab || []} />}
              {tab === 'listen' && <ListenPart vocab={l.vocab || []} onScore={(s) => save({ listen: s })} />}
              {tab === 'grammar' && <GrammarPart grammar={l.grammar || []} quiz={l.quiz || []} onScore={(s) => save({ grammar: s })} />}
              {tab === 'speak' && <SpeakPart speak={l.speak || []} />}
            </div>
          </section>
          <div className="lsn2-done">
            {st === 'done'
              ? <span className="ls-ok">✓ Bạn đã học xong bài này. Vào lại bất cứ lúc nào để ôn.</span>
              : <button type="button" className="btn-p" onClick={() => { save({ s: 'done' }); toast('Đã đánh dấu học xong bài ' + n + '.'); }}>✓ Đánh dấu đã học xong</button>}
          </div>
          <nav className="sd-pn">
            {n > 1 ? <button className="btn-s" type="button" onClick={() => go(n - 1)}>‹ Bài trước</button> : <span />}
            {n < total ? <button className={nextOpen ? 'btn-p' : 'btn-s'} type="button" onClick={() => go(n + 1)}>{nextOpen ? 'Bài sau ›' : '🔒 Bài sau'}</button> : <a className="btn-p" href={'#thi-hsk-' + lv}>🏆 Thi thử HSK{lv} ›</a>}
          </nav>
        </>
      )}
    </div>
  );
}
