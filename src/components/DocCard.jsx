import { art, ficon, FM } from './docArt.js';
import { docKind, fmtN, hasHan } from '../services/util.js';

const DL_ICON = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14" /></svg>;

export function FileIcon({ f, w = 16 }) {
  return <span className="ti" dangerouslySetInnerHTML={{ __html: ficon(f, w) }} />;
}

export function DocArt({ doc, idx }) {
  const a = doc.art || {};
  return <span className="art-wrap" dangerouslySetInnerHTML={{ __html: art([a.kind, a.l1, a.l2, a.ch, a.color], 'd' + idx) }} />;
}

export default function DocCard({ doc, idx, hot, maxDl, saved, onSave, onDownload }) {
  const a = doc.art || {}, m = FM[doc.format] || FM.PDF;
  return (
    <article className="cd" style={{ '--fc': a.color, animationDelay: idx * 0.045 + 's' }}>
      <div className="cd-img">
        {hasHan(a.ch) && <span className="cd-wm" aria-hidden="true">{a.ch}</span>}
        <DocArt doc={doc} idx={doc.id} />
        <span className="cd-fmt" style={{ '--fm': m.c }}><span dangerouslySetInnerHTML={{ __html: ficon(doc.format, 16) }} /><b>{m.l}</b></span>
        {hot ? <span className="cd-tag hot">🔥 HOT</span> : <span className="cd-tag">FREE</span>}
        <span className="cd-kind">{docKind(doc.url)}</span>
        {onSave && (
          <button type="button" className={'cd-save' + (saved ? ' on' : '')} onClick={onSave} aria-pressed={saved} title={saved ? 'Bỏ khỏi Kho của tôi' : 'Lưu vào Kho của tôi'}>
            {saved ? '♥' : '♡'}
          </button>
        )}
      </div>
      <div className="cd-body">
        <h3 className="cd-t">{doc.name}</h3>
        <div className="cd-meta"><span>⬇ <b>{fmtN(doc.downloads)}</b> lượt tải</span><span className="cd-free">Miễn phí</span></div>
        <div className="cd-pop" title="Mức độ quan tâm"><i style={{ width: Math.max(8, Math.round(((doc.downloads || 0) / (maxDl || 1)) * 100)) + '%' }} /></div>
        <a className="cd-btn" href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={'Tải xuống: ' + doc.name} onClick={onDownload}>
          <span className="cd-ic">{DL_ICON}</span><span className="cd-tx">Tải xuống</span>
        </a>
      </div>
    </article>
  );
}
