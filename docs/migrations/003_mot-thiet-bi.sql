-- Mọt Tiếng Trung — nâng cấp 003: mỗi tài khoản chỉ đăng nhập trên 1 thiết bị cùng lúc.
-- Chạy SAU docs/supabase.sql và docs/migrations/002_hoc-vien.sql. Chạy lại nhiều lần không sao (idempotent).
--
-- Cách hoạt động:
--  • Mỗi lần đăng nhập Supabase tạo một phiên mới; mã phiên nằm trong token (claim "session_id").
--  • Sau khi đăng nhập, web gọi claim_session() → ghi mã phiên đó là "phiên mới nhất" của tài khoản.
--  • Thiết bị cũ mang mã phiên khác → session_ok() trả false → web tự đăng xuất và báo cho người dùng.
--  • has_role() cũng kiểm tra phiên, nên thiết bị cũ mất quyền đọc bài học/tài liệu Học viên ngay ở database,
--    kể cả khi ai đó sửa code trên trình duyệt để bỏ qua bước kiểm tra.
--  • Quản trị viên (admin) và biên tập viên (editor) được miễn: đăng nhập nhiều máy cùng lúc.
--  • Tài khoản chưa từng claim (chưa đăng nhập lại từ khi có tính năng này) không bị chặn.

-- 1) Phiên mới nhất của mỗi tài khoản. Không có policy nào: chỉ các hàm security definer bên dưới đọc/ghi.
create table if not exists public.user_sessions (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  updated_at timestamptz not null default now()
);
alter table public.user_sessions enable row level security;
revoke all on public.user_sessions from anon, authenticated;

-- 2) Phiên hiện tại có phải phiên mới nhất không (khách / admin / editor / chưa claim → luôn đúng)
create or replace function public.session_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','editor'))
      or not exists (select 1 from public.user_sessions s where s.user_id = auth.uid())
      or exists (select 1 from public.user_sessions s
                  where s.user_id = auth.uid() and s.session_id = coalesce(auth.jwt()->>'session_id', ''));
$$;
grant execute on function public.session_ok() to anon, authenticated;

-- 3) Đánh dấu phiên hiện tại là phiên mới nhất (web gọi ngay sau khi đăng nhập)
create or replace function public.claim_session() returns boolean
language plpgsql security definer set search_path = public as $$
declare sid text := coalesce(auth.jwt()->>'session_id', '');
begin
  if auth.uid() is null then raise exception 'Bạn chưa đăng nhập.'; end if;
  if sid = '' then return false; end if;
  insert into public.user_sessions (user_id, session_id, updated_at) values (auth.uid(), sid, now())
  on conflict (user_id) do update set session_id = excluded.session_id, updated_at = now();
  return true;
end $$;
grant execute on function public.claim_session() to authenticated;

-- 4) has_role: như bản 002, thêm điều kiện phiên mới nhất (trừ admin/editor)
create or replace function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'active' and p.role = any(roles)
                   and (p.role <> 'student' or p.student_until is null or p.student_until > now())
                   and (p.role in ('admin','editor') or public.session_ok()));
$$;
