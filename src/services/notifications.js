// Thông báo trong chuông: tạo từ dữ liệu sẵn có (không cần bảng riêng trên Supabase).
// Mỗi thông báo: { id, at, icon, title, body, to, kind, tone }
//   at   : thời điểm (ms) — dùng để sắp xếp và tính chưa đọc (at > lần xem cuối)
//   to   : đường dẫn trong web khi bấm (vd '/nang-cap')
//   tone : 'ok' | 'warn' | 'info' | 'admin' — màu nhấn
import { RENEW_DAYS, tierOf } from './model.js';

const DAY = 86400000;
const fmtDate = (t) => new Date(t).toLocaleDateString('vi-VN');
export const NEW_DOC_DAYS = 14;

/** Thông báo chung admin soạn ở Cài đặt › Thông báo; audience: all | member | student */
export function announcementsFor(settings, tier, now = Date.now()) {
  return ((settings && settings.announcements) || [])
    .filter((a) => a && a.title && a.on !== false && (!a.until || a.until > now) && (!a.at || a.at <= now))
    .filter((a) => {
      const aud = a.audience || 'all';
      if (aud === 'all' || tier === 'staff') return true;
      if (aud === 'student') return tier === 'student';
      if (aud === 'member') return tier === 'member';
      return false;
    })
    .map((a) => ({ id: 'ann:' + a.id, at: a.at || 0, icon: a.icon || '📣', title: a.title, body: a.body || '', to: a.link || '', kind: 'announce', tone: 'info' }));
}

/**
 * Gom thông báo cho người đang xem.
 * data: { upgrade, subs, stages, docs, adminUpgrades, adminSubs } — phần nào chưa tải thì để undefined
 */
export function buildNotifications({ user, settings, data = {}, now = Date.now() }) {
  const tier = tierOf(user);
  const out = [...announcementsFor(settings, user ? tier : 'guest', now)];

  if (!user) return sort(out);

  // Tài liệu mới: đăng sau khi người này tạo tài khoản, trong 14 ngày gần đây (tài liệu có sẵn từ trước không tính là “mới”)
  const since = Math.max(now - NEW_DOC_DAYS * DAY, user.createdAt || 0);
  const fresh = (data.docs || []).filter((d) => d.published !== false && d.createdAt && d.createdAt > since)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (fresh.length) {
    out.push({
      id: 'docs:' + fresh[0].id, at: fresh[0].createdAt, icon: '📄', kind: 'docs', tone: 'info', to: '/',
      title: fresh.length === 1 ? 'Tài liệu mới: ' + fresh[0].name : fresh.length + ' tài liệu mới trong Kho',
      body: fresh.length === 1 ? 'Vào Kho tài liệu để xem và tải miễn phí.' : fresh.slice(0, 3).map((d) => d.name).join(' · '),
    });
  }

  // Chào mừng tài khoản mới (7 ngày đầu)
  if (tier === 'member' && user.createdAt && now - user.createdAt < 7 * DAY) {
    out.push({ id: 'welcome', at: user.createdAt, icon: '👋', kind: 'welcome', tone: 'info', to: '/khoa-hoc',
      title: 'Chào mừng ' + (user.name || 'bạn') + ' đến với Mọt Tiếng Trung!',
      body: 'Kho tài liệu và bài 1 mỗi cấp HSK học thử miễn phí. Đăng ký Khoá học để mở toàn bộ bài học.' });
  }

  // Đăng ký / gia hạn Học viên
  const up = data.upgrade;
  if (up) {
    if (up.status === 'paid' && up.paidAt) {
      out.push({ id: 'up-paid:' + up.id, at: up.paidAt, icon: '🎉', kind: 'upgrade', tone: 'ok', to: '/khoa-hoc',
        title: 'Đã kích hoạt Học viên',
        body: 'Mọt đã nhận chuyển khoản mã ' + up.code + '.' + (user.studentUntil ? ' Hạn học viên đến ' + fmtDate(user.studentUntil) + '.' : '') + ' Vào học ngay!' });
    } else if (up.status === 'claimed') {
      out.push({ id: 'up-claimed:' + up.id, at: up.claimedAt || up.createdAt, icon: '⏳', kind: 'upgrade', tone: 'info', to: '/nang-cap',
        title: 'Đang chờ xác nhận chuyển khoản',
        body: 'Mọt đã nhận báo chuyển khoản mã ' + up.code + ', sẽ kích hoạt trong 24 giờ.' });
    } else if (up.status === 'pending') {
      out.push({ id: 'up-pending:' + up.id, at: up.createdAt, icon: '💳', kind: 'upgrade', tone: 'warn', to: '/nang-cap',
        title: 'Bạn còn mã giao dịch chưa thanh toán',
        body: 'Mã ' + up.code + '. Chuyển khoản xong nhớ bấm “Tôi đã chuyển khoản”.' });
    }
  }

  // Hạn Học viên
  if (user.role === 'student' && user.studentUntil) {
    const left = user.studentUntil - now;
    if (left <= 0) {
      out.push({ id: 'exp:' + user.studentUntil, at: user.studentUntil, icon: '⌛', kind: 'expiry', tone: 'warn', to: '/nang-cap',
        title: 'Gói Học viên đã hết hạn',
        body: 'Hết hạn ngày ' + fmtDate(user.studentUntil) + '. Tài khoản đã về tài khoản thường, tiến độ học vẫn được giữ. Gia hạn để học tiếp.' });
    } else if (left <= RENEW_DAYS * DAY) {
      const days = Math.ceil(left / DAY);
      const step = days <= 3 ? 3 : days <= 7 ? 7 : RENEW_DAYS; // mỗi mốc 30 / 7 / 3 ngày là một thông báo mới
      out.push({ id: 'soon:' + user.studentUntil + ':' + step, at: user.studentUntil - step * DAY, icon: '⏰', kind: 'expiry', tone: 'warn', to: '/nang-cap',
        title: 'Gói Học viên còn ' + days + ' ngày',
        body: 'Hết hạn ngày ' + fmtDate(user.studentUntil) + '. Gia hạn sớm, thời gian mới được cộng nối tiếp.' });
    }
  }

  // Bài kiểm tra đã chấm
  const stageName = (id) => { const s = (data.stages || []).find((x) => x.id === id); return s ? s.key + ' · ' + s.title : 'chặng'; };
  (data.subs || []).filter((x) => x.status === 'graded' && x.gradedAt && x.gradedBy).slice(0, 5).forEach((x) => {
    out.push({ id: 'graded:' + x.id, at: x.gradedAt, icon: x.passed ? '🏆' : '📝', kind: 'grade', tone: x.passed ? 'ok' : 'info', to: '/lo-trinh/' + x.stageId,
      title: 'Bài kiểm tra ' + stageName(x.stageId) + ' đã được chấm',
      body: x.pct + '% · ' + (x.passed ? 'Đạt, chặng tiếp theo đã mở.' : 'Chưa đạt, xem nhận xét và làm lại nhé.') + (x.feedback ? ' Nhận xét: “' + x.feedback + '”' : '') });
  });

  // Việc chờ admin / biên tập
  if (tier === 'staff') {
    const claimed = (data.adminUpgrades || []).filter((r) => r.status === 'claimed');
    if (claimed.length) {
      const last = Math.max(...claimed.map((r) => r.claimedAt || r.createdAt));
      out.push({ id: 'adm-up:' + last, at: last, icon: '💰', kind: 'admin', tone: 'admin', to: '/admin/nang-cap',
        title: claimed.length + ' người báo đã chuyển khoản',
        body: 'Kiểm tra ngân hàng rồi xác nhận để kích hoạt Học viên: ' + claimed.slice(0, 3).map((r) => r.code).join(', ') + (claimed.length > 3 ? '…' : '') });
    }
    const pend = (data.adminSubs || []).filter((x) => x.status === 'pending');
    if (pend.length) {
      const last = Math.max(...pend.map((x) => x.createdAt));
      out.push({ id: 'adm-sub:' + last, at: last, icon: '✍️', kind: 'admin', tone: 'admin', to: '/admin/cham-bai',
        title: pend.length + ' bài kiểm tra chờ chấm', body: 'Học viên đang chờ kết quả để mở chặng tiếp theo.' });
    }
  }
  return sort(out);
}

const sort = (list) => list.sort((a, b) => b.at - a.at);
