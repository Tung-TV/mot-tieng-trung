-- Mọt Tiếng Trung — schema cho Supabase (gói Free)
-- Chạy toàn bộ file này trong Supabase › SQL Editor.

-- 1) Nội dung: tài liệu, chặng lộ trình, cài đặt (lưu dạng JSON để khớp với app)
create table if not exists public.content (
  id          text primary key,
  kind        text not null check (kind in ('document','stage','settings')),
  sort        bigint not null default 0,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 2) Hồ sơ người dùng (gắn với auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  role        text not null default 'member' check (role in ('member','editor','admin')),
  status      text not null default 'active' check (status in ('active','locked')),
  progress    jsonb not null default '{}'::jsonb,
  avatar      text,
  provider    text not null default 'email',
  created_at  timestamptz not null default now()
);

-- Nâng cấp từ bản trước (đã chạy file này rồi): thêm cột cho đăng nhập Google
alter table public.profiles add column if not exists avatar text;
alter table public.profiles add column if not exists provider text not null default 'email';

-- Tự tạo hồ sơ khi có người đăng ký (email/mật khẩu hoặc Google)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, avatar, provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kiểm tra quyền của người đang đăng nhập
create or replace function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'active' and p.role = any(roles));
$$;

-- Học viên không được tự đổi role/status của chính mình
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() rỗng = chạy từ SQL Editor / service role: cho phép
  if auth.uid() is not null and not public.has_role(array['admin']) then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Tăng lượt tải (ai cũng gọi được, kể cả khách)
create or replace function public.bump_download(doc_id text) returns void
language sql security definer set search_path = public as $$
  update public.content
     set data = jsonb_set(data, '{downloads}', to_jsonb(coalesce((data->>'downloads')::int,0) + 1))
   where id = doc_id and kind = 'document';
$$;
grant execute on function public.bump_download(text) to anon, authenticated;

-- Quyền truy cập qua Data API (project mới có thể không tự cấp)
grant usage on schema public to anon, authenticated;
grant select on public.content to anon, authenticated;
grant insert, update, delete on public.content to authenticated;
grant select, update, delete on public.profiles to authenticated;

-- 3) Bảo mật theo dòng (RLS)
alter table public.content  enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "content đọc công khai" on public.content;
create policy "content đọc công khai" on public.content for select using (true);

drop policy if exists "content biên tập ghi" on public.content;
create policy "content biên tập ghi" on public.content for all
  using (case when kind = 'settings' then public.has_role(array['admin'])
              else public.has_role(array['admin','editor']) end)
  with check (case when kind = 'settings' then public.has_role(array['admin'])
                   else public.has_role(array['admin','editor']) end);

drop policy if exists "profiles tự xem" on public.profiles;
create policy "profiles tự xem" on public.profiles for select
  using (id = auth.uid() or public.has_role(array['admin']));

drop policy if exists "profiles tự sửa" on public.profiles;
create policy "profiles tự sửa" on public.profiles for update
  using (id = auth.uid() or public.has_role(array['admin']));

drop policy if exists "profiles admin xoá" on public.profiles;
create policy "profiles admin xoá" on public.profiles for delete
  using (public.has_role(array['admin']));

-- 4) Dữ liệu ban đầu: chạy tiếp file docs/seed.sql (chỉ thêm khi bảng content còn trống).
-- 5) Sau khi tự đăng ký tài khoản đầu tiên trên web, nâng nó thành admin:
-- update public.profiles set role = 'admin' where email = 'email-cua-ban@gmail.com';
