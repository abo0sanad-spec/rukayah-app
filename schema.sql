-- تفعيل الامتدادات اللازمة
create extension if not exists "uuid-ossp";

-- الجداول
create table if not exists students(
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  class_name text not null
);

create table if not exists student_tokens(
  token text primary key,
  student_id uuid references students(id) on delete cascade,
  expires_at timestamptz not null
);

create type initiative_status as enum ('pending','approved','returned','rejected');

create table if not exists initiatives(
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete set null,
  student_name text,
  class_name text,
  value_category text check (value_category in ('الانضباط','التعاون','الأمانة','العزيمة')),
  title text not null,
  description text,
  submitted_at timestamptz not null default now(),
  status initiative_status not null default 'pending',
  reviewed_at timestamptz,
  reviewer text,

  base_points numeric,
  value_weight numeric,
  impact_factor numeric,
  evidence_factor numeric,
  penalty numeric default 0,
  total_points numeric
);

-- العروض (Views)
create or replace view initiatives_weekly as
select
  i.student_id,
  coalesce(i.student_name, 'غير معروف') as student_name,
  coalesce(i.class_name, '-') as class_name,
  sum(coalesce(i.total_points,0)) as total_points_sum
from initiatives i
where i.status = 'approved'
  and date_trunc('week', i.reviewed_at) = date_trunc('week', now())
group by i.student_id, i.student_name, i.class_name;

create or replace view initiatives_monthly_values as
select
  date_trunc('month', i.reviewed_at) as month,
  i.value_category,
  count(*) as initiatives_count,
  sum(coalesce(i.total_points,0)) as total_points_sum
from initiatives i
where i.status = 'approved'
group by date_trunc('month', i.reviewed_at), i.value_category;

-- الدالة: استلام رمز الطالبة
create or replace function claim_student_token(p_token text)
returns students
language plpgsql
security definer
as $$
declare s students;
begin
  select st.* into s
  from student_tokens t
  join students st on st.id = t.student_id
  where t.token = p_token
    and t.expires_at > now();

  if not found then
    raise exception 'INVALID_TOKEN';
  end if;

  -- إزالة الرمز بعد الاستخدام لمنع التكرار
  delete from student_tokens where token = p_token;

  return s;
end;
$$;

-- تفعيل RLS
alter table students enable row level security;
alter table student_tokens enable row level security;
alter table initiatives enable row level security;

-- سياسات مبسطة
-- SELECT عام
create policy public_select_students on students for select using (true);
create policy public_select_tokens on student_tokens for select using (true);
create policy public_select_initiatives on initiatives for select using (true);

-- INSERT للواجهة (anon)
create policy public_insert_initiatives on initiatives for insert with check (true);

-- UPDATE للمصادّقين فقط
create policy auth_update_initiatives on initiatives for update to authenticated using (true);

-- السماح بتنفيذ الدالة للجميع (بسبب security definer لا يحتاج صلاحيات إضافية)
grant execute on function claim_student_token(text) to anon, authenticated;

-- أمثلة بيانات
insert into students (id, name, class_name) values
  ('11111111-1111-1111-1111-111111111111','ليان أحمد','3/أ'),
  ('22222222-2222-2222-2222-222222222222','نورة محمد','2/ب'),
  ('33333333-3333-3333-3333-333333333333','جود خالد','1/ج')
on conflict do nothing;

insert into student_tokens(token, student_id, expires_at) values
  ('RUK-001','11111111-1111-1111-1111-111111111111', now() + interval '14 day'),
  ('RUK-002','22222222-2222-2222-2222-222222222222', now() + interval '14 day'),
  ('RUK-003','33333333-3333-3333-3333-333333333333', now() + interval '14 day')
on conflict do nothing;
