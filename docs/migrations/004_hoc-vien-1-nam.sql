-- Mọt Tiếng Trung — nâng cấp 004: gói Học viên mặc định 1 năm (12 tháng), không còn "vĩnh viễn" do thời hạn 0.
-- Chạy SAU 002_hoc-vien.sql (và 003 nếu đã chạy). Chạy lại nhiều lần không sao.
--
-- Vì sao: bản 002 tạo sẵn gói với months = 0 (= không giới hạn) và lấy 0 làm mặc định,
-- nên học viên được admin xác nhận chuyển khoản thành Học viên không thời hạn.

-- 1) Gói trong Cài đặt: thời hạn 0 hoặc thiếu → 12 tháng
update public.content
   set data = jsonb_set(data, '{plan,months}', '12'::jsonb)
 where id = 'settings' and data ? 'plan'
   and coalesce((data->'plan'->>'months')::int, 0) <= 0;

-- 2) Yêu cầu đang chờ (chưa xác nhận) mang 0 tháng → 12 tháng
update public.upgrade_requests set months = 12 where status in ('pending','claimed') and months <= 0;
alter table public.upgrade_requests alter column months set default 12;

-- 3) Tạo mã giao dịch: thiếu thời hạn thì mặc định 12 tháng
create or replace function public.create_upgrade_request() returns public.upgrade_requests
language plpgsql security definer set search_path = public as $$
declare r public.upgrade_requests; p public.profiles; plan jsonb; c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'Vui lòng đăng nhập.'; end if;
  -- thành viên thường, hoặc học viên đã hết hạn / còn ≤ 30 ngày (gia hạn sớm, hạn mới cộng nối tiếp)
  if p.role <> 'member' and not (p.role = 'student' and p.student_until is not null and p.student_until < now() + interval '30 days') then
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
  values (p.id, p.name, p.email, c, coalesce((plan->>'price')::int, 365000),
          case when coalesce((plan->>'months')::int, 0) > 0 then (plan->>'months')::int else 12 end)
  returning * into r;
  return r;
end $$;

-- 4) Xác nhận đã nhận tiền: luôn đặt hạn (0 tháng → 12), cộng nối tiếp nếu còn hạn
create or replace function public.confirm_upgrade(p_id uuid) returns public.upgrade_requests
language plpgsql security definer set search_path = public as $$
declare r public.upgrade_requests; who text; m int;
begin
  if not public.has_role(array['admin']) then raise exception 'Chỉ quản trị viên được xác nhận thanh toán.'; end if;
  select * into r from public.upgrade_requests where id = p_id for update;
  if r.id is null then raise exception 'Không tìm thấy yêu cầu.'; end if;
  if r.status = 'paid' then return r; end if;
  if r.status = 'cancelled' then raise exception 'Yêu cầu đã huỷ.'; end if;
  m := case when r.months > 0 then r.months else 12 end;
  select email into who from public.profiles where id = auth.uid();
  update public.profiles
     set role = case when role in ('member','student') then 'student' else role end,
         student_until = greatest(now(), coalesce(student_until, now())) + make_interval(months => m)
   where id = r.user_id;
  update public.upgrade_requests set status = 'paid', paid_at = now(), confirmed_by = who, months = m where id = p_id returning * into r;
  return r;
end $$;

grant execute on function public.create_upgrade_request() to authenticated;
grant execute on function public.confirm_upgrade(uuid) to authenticated;

-- 5) (TUỲ CHỌN — bỏ dấu -- để chạy) Học viên hiện đang "không thời hạn" → hạn 1 năm tính từ ngày xác nhận chuyển khoản gần nhất
--    (người chưa từng chuyển khoản, ví dụ admin cấp tay, thì tính từ hôm nay). Xem trước bằng câu select, rồi mới chạy update.
-- select p.email, (select max(paid_at) from public.upgrade_requests u where u.user_id = p.id and u.status = 'paid') as paid_at
--   from public.profiles p where p.role = 'student' and p.student_until is null;
-- update public.profiles p
--    set student_until = coalesce((select max(paid_at) from public.upgrade_requests u where u.user_id = p.id and u.status = 'paid'), now()) + interval '12 months'
--  where p.role = 'student' and p.student_until is null;
