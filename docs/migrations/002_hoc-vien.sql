-- Mọt Tiếng Trung — nâng cấp 002: 3 loại tài khoản (thành viên / học viên / quản trị),
-- nâng cấp bằng chuyển khoản, bài kiểm tra mở khoá chặng.
-- Chạy SAU docs/supabase.sql. Chạy lại nhiều lần không sao (idempotent).

-- 1) Loại nội dung mới:
--    stage        : phần công khai của chặng (tên, mô tả, kỹ năng)        → ai cũng đọc
--    stage_detail : bài học, giáo trình, link, câu hỏi kiểm tra (không đáp án) → học viên trở lên
--    test_key     : đáp án bài kiểm tra                                    → chỉ biên tập/quản trị
--    premium      : link mua, túi đồ nghề, app học, prompt                  → học viên trở lên
alter table public.content drop constraint if exists content_kind_check;
alter table public.content add constraint content_kind_check
  check (kind in ('document','stage','stage_detail','test_key','settings','premium'));

-- 2) Hồ sơ: vai trò học viên + hạn dùng
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('member','student','editor','admin'));
alter table public.profiles add column if not exists student_until timestamptz;

-- has_role: học viên hết hạn thì không còn quyền học viên
create or replace function public.has_role(roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
                 where p.id = auth.uid() and p.status = 'active' and p.role = any(roles)
                   and (p.role <> 'student' or p.student_until is null or p.student_until > now()));
$$;

-- Người dùng tự sửa được tên/tiến độ, KHÔNG sửa được vai trò, trạng thái, hạn học viên, email,
-- và KHÔNG tự ghi điểm kiểm tra (chỉ hàm chấm điểm trong database ghi được).
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(array['admin']) then return new; end if;
  new.role := old.role;
  new.status := old.status;
  new.student_until := old.student_until;
  new.email := old.email;
  new.provider := old.provider;
  if coalesce(current_setting('mot.trusted', true), '') <> '1' then
    new.progress := jsonb_set(coalesce(new.progress, '{}'::jsonb), '{tests}', coalesce(old.progress->'tests', '{}'::jsonb));
    new.progress := jsonb_set(new.progress, '{done}', coalesce(old.progress->'done', '[]'::jsonb));
  end if;
  return new;
end $$;

-- 3) Quyền đọc nội dung theo loại tài khoản
drop policy if exists "content đọc công khai" on public.content;
create policy "content đọc công khai" on public.content for select using (
  (kind = 'document' and coalesce(data->>'published', 'true') <> 'false')
  or kind in ('stage','settings')
  or (kind in ('stage_detail','premium') and public.has_role(array['student','editor','admin']))
  or public.has_role(array['editor','admin'])
);
drop policy if exists "content biên tập ghi" on public.content;
create policy "content biên tập ghi" on public.content for all
  using (case when kind in ('settings','premium') then public.has_role(array['admin'])
              else public.has_role(array['admin','editor']) end)
  with check (case when kind in ('settings','premium') then public.has_role(array['admin'])
                   else public.has_role(array['admin','editor']) end);

-- 4) Chuyển dữ liệu cũ (chặng/cài đặt lưu một khối) sang dạng tách
insert into public.content (id, kind, sort, data)
select 'sd:' || c.id, 'stage_detail', c.sort,
       (c.data - array['order','key','emoji','color','whiteText','title','badge','desc','chips']) || jsonb_build_object('id', c.id)
from public.content c
where c.kind = 'stage' and c.data ? 'sections'
on conflict (id) do nothing;
update public.content
   set data = jsonb_strip_nulls(jsonb_build_object(
     'id', data->'id', 'order', data->'order', 'key', data->'key', 'emoji', data->'emoji', 'color', data->'color',
     'whiteText', data->'whiteText', 'title', data->'title', 'badge', data->'badge', 'desc', data->'desc', 'chips', data->'chips'))
 where kind = 'stage' and data ? 'sections';
insert into public.content (id, kind, sort, data)
select 'premium', 'premium', 0, jsonb_build_object('affiliate', data->'affiliate', 'tools', data->'tools', 'apps', data->'apps', 'prompts', data->'prompts')
from public.content where id = 'settings' and data ? 'tools'
on conflict (id) do nothing;
update public.content set data = data - array['affiliate','tools','apps','prompts'] where id = 'settings' and data ? 'tools';

-- 5) Bài kiểm tra kiểu HSK: nghe / đọc / viết / nói — chấm tự động phần khách quan, phần tự luận & nói chờ chấm tay
--    Đáp án nằm ở content id 'tk:<chặng>' = { keys: { <mã câu>: { type, points, answer | accept | guide } } }
--    Chặng có data.completion = 'button' (VD Nhập môn) hoàn thành bằng nút, không cần bài kiểm tra.
update public.content d set data = d.data || jsonb_build_object('completion', case when p.data->>'key' = 'Nhập môn' then 'button' else 'test' end)
  from public.content p
 where d.kind = 'stage_detail' and p.id = substr(d.id, 4) and p.kind = 'stage' and coalesce(d.data->>'completion', '') = '';

create or replace function public.stage_passed(p_progress jsonb, p_stage text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when (select data->>'completion' from public.content where id = 'sd:' || p_stage) = 'button'
      then coalesce(p_progress->'done', '[]'::jsonb) ? p_stage
    else coalesce((p_progress->'tests'->p_stage->>'passed')::boolean, false)
  end;
$$;

-- chặng p_stage có đang mở với người dùng này không (mọi chặng đứng trước đã qua)
create or replace function public.stage_open(p_progress jsonb, p_stage text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s record;
begin
  if public.has_role(array['editor','admin']) then return true; end if;
  for s in select id from public.content where kind = 'stage'
           and sort < (select sort from public.content where id = p_stage and kind = 'stage') order by sort loop
    if not public.stage_passed(p_progress, s.id) then return false; end if;
  end loop;
  return true;
end $$;

create table if not exists public.test_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text,
  email        text,
  stage_id     text not null,
  stage_key    text,
  answers      jsonb not null default '{}',
  items        jsonb not null default '{}',   -- điểm từng câu; null = chờ chấm tay
  auto         numeric not null default 0,
  earned       numeric,
  total        numeric not null default 0,
  manual_total numeric not null default 0,
  status       text not null default 'graded' check (status in ('pending','graded')),
  pct          int,
  passed       boolean,
  feedback     text,
  created_at   timestamptz not null default now(),
  graded_at    timestamptz,
  graded_by    text
);
create index if not exists test_submissions_status on public.test_submissions (status, created_at desc);
alter table public.test_submissions enable row level security;
grant select on public.test_submissions to authenticated;
drop policy if exists "bài làm tự xem" on public.test_submissions;
create policy "bài làm tự xem" on public.test_submissions for select
  using (user_id = auth.uid() or public.has_role(array['editor','admin']));

create or replace function public.norm_answer(x text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(x, '')), '[[:space:][:punct:]，。！？、；：“”‘’（）《》…·]', '', 'g') $$;

-- ghi kết quả vào tiến độ của học viên (bỏ qua trigger bảo vệ)
create or replace function public.record_test(p_user uuid, p_stage text, p_rec jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('mot.trusted', '1', true);
  update public.profiles
     set progress = jsonb_set(jsonb_set(coalesce(progress, '{}'::jsonb), '{tests}', coalesce(progress->'tests', '{}'::jsonb)), array['tests', p_stage], p_rec)
   where id = p_user;
  perform set_config('mot.trusted', '', true);
end $$;
revoke all on function public.record_test(uuid, text, jsonb) from public, anon, authenticated;

drop function if exists public.submit_test(text, int[]);
create or replace function public.submit_test(p_stage text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k jsonb; q record; pts numeric; a jsonb; ok boolean; v_earned numeric := 0; v_total numeric := 0; man numeric := 0;
        v_items jsonb := '{}'; prog jsonb; prev jsonb; rec jsonb; pass int; v_pct int; v_passed boolean; sub public.test_submissions; p public.profiles; st text;
begin
  if not public.has_role(array['student','editor','admin']) then raise exception 'Tính năng dành cho học viên.'; end if;
  select data->'keys' into k from public.content where id = 'tk:' || p_stage;
  if k is null or k = '{}'::jsonb then raise exception 'Chặng này chưa có bài kiểm tra.'; end if;
  select * into p from public.profiles where id = auth.uid();
  prog := coalesce(p.progress, '{}'::jsonb);
  if not public.stage_open(prog, p_stage) then raise exception 'Bạn cần hoàn thành chặng trước để mở chặng này.'; end if;
  prev := coalesce(prog->'tests'->p_stage, '{}'::jsonb);
  if coalesce((prev->>'pending')::boolean, false) then raise exception 'Bài trước của bạn đang chờ chấm, chưa nộp lại được.'; end if;
  select coalesce((data->'test'->>'pass')::int, 70) into pass from public.content where id = 'sd:' || p_stage;
  for q in select key as id, value as v from jsonb_each(k) loop
    pts := greatest(coalesce((q.v->>'points')::numeric, 1), 0);
    v_total := v_total + pts;
    a := coalesce(p_answers, '{}'::jsonb)->q.id;
    if q.v->>'type' in ('write','speak') then
      man := man + pts; v_items := v_items || jsonb_build_object(q.id, null);
    else
      ok := case q.v->>'type'
        when 'fill' then public.norm_answer(a #>> '{}') <> '' and exists (select 1 from jsonb_array_elements_text(coalesce(q.v->'accept','[]')) x where public.norm_answer(x) = public.norm_answer(a #>> '{}'))
        when 'order' then jsonb_typeof(a) = 'array' and a = q.v->'answer'
        else a is not null and jsonb_typeof(a) in ('number','string') and (a #>> '{}') ~ '^\d+$' and (a #>> '{}')::int = (q.v->>'answer')::int
      end;
      v_items := v_items || jsonb_build_object(q.id, case when ok then pts else 0 end);
      if ok then v_earned := v_earned + pts; end if;
    end if;
  end loop;
  st := case when man > 0 then 'pending' else 'graded' end;
  if st = 'graded' then v_pct := case when v_total > 0 then round(v_earned * 100 / v_total) else 0 end; v_passed := v_pct >= coalesce(pass, 70); end if;
  insert into public.test_submissions (user_id, name, email, stage_id, stage_key, answers, items, auto, earned, total, manual_total, status, pct, passed)
  values (p.id, p.name, p.email, p_stage, (select data->>'key' from public.content where id = p_stage), coalesce(p_answers, '{}'), v_items, v_earned,
          case when st = 'graded' then v_earned end, v_total, man, st, v_pct, v_passed)
  returning * into sub;
  if st = 'pending' then
    rec := prev || jsonb_build_object('pending', true, 'attempts', coalesce((prev->>'attempts')::int, 0) + 1, 'at', (extract(epoch from now()) * 1000)::bigint, 'lastSub', sub.id);
  else
    rec := prev || jsonb_build_object('pending', false, 'best', greatest(coalesce((prev->>'best')::int, 0), v_pct), 'last', v_pct,
             'passed', coalesce((prev->>'passed')::boolean, false) or v_passed, 'attempts', coalesce((prev->>'attempts')::int, 0) + 1,
             'at', (extract(epoch from now()) * 1000)::bigint, 'lastSub', sub.id);
  end if;
  perform public.record_test(p.id, p_stage, rec);
  return jsonb_build_object('status', st, 'earned', v_earned, 'total', v_total, 'manual', man, 'pct', v_pct, 'passed', coalesce(v_passed, false), 'items', v_items);
end $$;

-- biên tập/quản trị chấm phần tự luận & nói
create or replace function public.grade_submission(p_id uuid, p_manual jsonb, p_feedback text) returns public.test_submissions
language plpgsql security definer set search_path = public as $$
declare sub public.test_submissions; k jsonb; q record; v_items jsonb; v_earned numeric := 0; v_pct int; v_passed boolean; pass int; who text; prev jsonb; rec jsonb; v jsonb;
begin
  if not public.has_role(array['editor','admin']) then raise exception 'Chỉ biên tập/quản trị được chấm bài.'; end if;
  select * into sub from public.test_submissions where id = p_id for update;
  if sub.id is null then raise exception 'Không tìm thấy bài làm.'; end if;
  select data->'keys' into k from public.content where id = 'tk:' || sub.stage_id;
  v_items := sub.items;
  for q in select key as id, value as v from jsonb_each(coalesce(k, '{}')) where value->>'type' in ('write','speak') loop
    v_items := v_items || jsonb_build_object(q.id, least(greatest(coalesce((p_manual->>q.id)::numeric, 0), 0), coalesce((q.v->>'points')::numeric, 1)));
  end loop;
  for v in select value from jsonb_each(v_items) loop
    if jsonb_typeof(v) = 'number' then v_earned := v_earned + (v #>> '{}')::numeric; end if;
  end loop;
  select coalesce((data->'test'->>'pass')::int, 70) into pass from public.content where id = 'sd:' || sub.stage_id;
  v_pct := case when sub.total > 0 then round(v_earned * 100 / sub.total) else 0 end;
  v_passed := v_pct >= coalesce(pass, 70);
  select email into who from public.profiles where id = auth.uid();
  update public.test_submissions set items = v_items, earned = v_earned, pct = v_pct, passed = v_passed, status = 'graded',
         feedback = p_feedback, graded_at = now(), graded_by = who
   where id = p_id returning * into sub;
  select coalesce(progress->'tests'->sub.stage_id, '{}'::jsonb) into prev from public.profiles where id = sub.user_id;
  rec := prev || jsonb_build_object('best', greatest(coalesce((prev->>'best')::int, 0), v_pct), 'last', v_pct,
           'passed', coalesce((prev->>'passed')::boolean, false) or v_passed, 'feedback', coalesce(p_feedback, ''),
           'pending', case when prev->>'lastSub' = p_id::text then false else coalesce((prev->>'pending')::boolean, false) end);
  perform public.record_test(sub.user_id, sub.stage_id, rec);
  return sub;
end $$;

-- chặng hoàn thành bằng nút (VD Nhập môn)
create or replace function public.complete_stage(p_stage text) returns void
language plpgsql security definer set search_path = public as $$
declare prog jsonb;
begin
  if not public.has_role(array['student','editor','admin']) then raise exception 'Tính năng dành cho học viên.'; end if;
  if coalesce((select data->>'completion' from public.content where id = 'sd:' || p_stage), 'test') <> 'button' then
    raise exception 'Chặng này cần làm bài kiểm tra để hoàn thành.';
  end if;
  select progress into prog from public.profiles where id = auth.uid();
  if not public.stage_open(prog, p_stage) then raise exception 'Bạn cần hoàn thành chặng trước.'; end if;
  perform set_config('mot.trusted', '1', true);
  update public.profiles
     set progress = jsonb_set(coalesce(progress, '{}'::jsonb), '{done}',
           (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements_text(coalesce(progress->'done','[]'::jsonb) || to_jsonb(p_stage)) x))
   where id = auth.uid();
  perform set_config('mot.trusted', '', true);
end $$;

grant execute on function public.submit_test(text, jsonb) to authenticated;
grant execute on function public.grade_submission(uuid, jsonb, text) to authenticated;
grant execute on function public.complete_stage(text) to authenticated;

-- Lưu trữ tệp: "media" (âm thanh/hình của đề, công khai), "speaking" (bản ghi âm của học viên, riêng tư)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict (id) do nothing;
    insert into storage.buckets (id, name, public) values ('speaking', 'speaking', false) on conflict (id) do nothing;
    drop policy if exists "media biên tập tải lên" on storage.objects;
    create policy "media biên tập tải lên" on storage.objects for insert to authenticated
      with check (bucket_id = 'media' and public.has_role(array['editor','admin']));
    drop policy if exists "media biên tập sửa" on storage.objects;
    create policy "media biên tập sửa" on storage.objects for update to authenticated
      using (bucket_id = 'media' and public.has_role(array['editor','admin']));
    drop policy if exists "ghi âm học viên tải lên" on storage.objects;
    create policy "ghi âm học viên tải lên" on storage.objects for insert to authenticated
      with check (bucket_id = 'speaking' and (storage.foldername(name))[1] = auth.uid()::text and public.has_role(array['student','editor','admin']));
    drop policy if exists "ghi âm xem" on storage.objects;
    create policy "ghi âm xem" on storage.objects for select to authenticated
      using (bucket_id = 'speaking' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(array['editor','admin'])));
  end if;
end $$;

-- 6) Yêu cầu nâng cấp (chuyển khoản kèm mã giao dịch, admin xác nhận)
create table if not exists public.upgrade_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  name         text,
  email        text,
  code         text not null unique,
  amount       int  not null,
  months       int  not null default 0,
  status       text not null default 'pending' check (status in ('pending','claimed','paid','cancelled')),
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  paid_at      timestamptz,
  confirmed_by text
);
alter table public.upgrade_requests enable row level security;
grant select on public.upgrade_requests to authenticated;
drop policy if exists "upgrade tự xem" on public.upgrade_requests;
create policy "upgrade tự xem" on public.upgrade_requests for select
  using (user_id = auth.uid() or public.has_role(array['admin']));

create or replace function public.create_upgrade_request() returns public.upgrade_requests
language plpgsql security definer set search_path = public as $$
declare r public.upgrade_requests; p public.profiles; plan jsonb; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Vui lòng đăng nhập.'; end if;
  if p.role <> 'member' and not (p.role = 'student' and p.student_until is not null and p.student_until < now()) then
    raise exception 'Tài khoản của bạn không cần nâng cấp.';
  end if;
  select * into r from public.upgrade_requests where user_id = p.id and status in ('pending','claimed') order by created_at desc limit 1;
  if r.id is not null then return r; end if;
  select data->'plan' into plan from public.content where id = 'settings';
  loop
    c := 'MOT';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.upgrade_requests where code = c);
  end loop;
  insert into public.upgrade_requests (user_id, name, email, code, amount, months)
  values (p.id, p.name, p.email, c, coalesce((plan->>'price')::int, 199000), coalesce((plan->>'months')::int, 0))
  returning * into r;
  return r;
end $$;

create or replace function public.claim_upgrade(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.upgrade_requests set status = 'claimed', claimed_at = now()
   where id = p_id and user_id = auth.uid() and status = 'pending';
$$;

create or replace function public.cancel_upgrade(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.upgrade_requests set status = 'cancelled'
   where id = p_id and status in ('pending','claimed') and (user_id = auth.uid() or public.has_role(array['admin']));
end $$;

create or replace function public.confirm_upgrade(p_id uuid) returns public.upgrade_requests
language plpgsql security definer set search_path = public as $$
declare r public.upgrade_requests; who text;
begin
  if not public.has_role(array['admin']) then raise exception 'Chỉ quản trị viên được xác nhận thanh toán.'; end if;
  select * into r from public.upgrade_requests where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy yêu cầu.'; end if;
  if r.status = 'paid' then return r; end if;
  if r.status = 'cancelled' then raise exception 'Yêu cầu đã huỷ.'; end if;
  select email into who from public.profiles where id = auth.uid();
  update public.profiles
     set role = case when role in ('member','student') then 'student' else role end,
         student_until = case when r.months > 0 then greatest(now(), coalesce(student_until, now())) + make_interval(months => r.months) else null end
   where id = r.user_id;
  update public.upgrade_requests set status = 'paid', paid_at = now(), confirmed_by = who where id = p_id returning * into r;
  return r;
end $$;

grant execute on function public.create_upgrade_request() to authenticated;
grant execute on function public.claim_upgrade(uuid) to authenticated;
grant execute on function public.cancel_upgrade(uuid) to authenticated;
grant execute on function public.confirm_upgrade(uuid) to authenticated;

-- 7) Bổ sung cấu hình gói học viên + mã ngân hàng VietQR nếu chưa có
update public.content
   set data = data
     || case when data ? 'plan' then '{}'::jsonb else jsonb_build_object('plan', jsonb_build_object(
          'name', 'Học viên Mọt Tiếng Trung', 'price', 199000, 'months', 0,
          'benefits', jsonb_build_array('Mở toàn bộ lộ trình 9 chặng, từ Vỡ lòng tới HSK 7–9',
            'Chi tiết từng chặng: bài học, giáo trình, tài liệu đi kèm',
            'Bài kiểm tra cuối chặng, lưu điểm và tiến độ cá nhân',
            'Túi đồ nghề và hướng dẫn app học'))) end
     || case when data->'bank' ? 'bankId' then '{}'::jsonb else jsonb_build_object('bank', (data->'bank') || '{"bankId":"MB"}') end
 where id = 'settings';

-- 8) Kênh hỗ trợ Zalo / Facebook (điền trong CMS › Cài đặt › Hỗ trợ)
update public.content
   set data = data || jsonb_build_object('support', jsonb_build_object('zalo', '', 'facebook', '', 'messenger', '', 'hours', '8:00 – 22:00 hằng ngày', 'floating', true))
 where id = 'settings' and not (data ? 'support');
