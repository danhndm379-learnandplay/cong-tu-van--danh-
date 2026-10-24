-- Học bổng theo từng trường, để AI tra cứu và gợi ý cho học viên.
-- DỮ LIỆU CÔNG KHAI: ai cũng được ĐỌC. Thêm/sửa/xoá chỉ server (service_role) làm được.

create table public.scholarships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  -- Điều kiện tối thiểu: chỉ tiêu (điểm học tập thang 10 hoặc IELTS) và ngưỡng từ bao nhiêu.
  condition_metric text not null check (condition_metric in ('gpa', 'ielts')),
  condition_min numeric(4, 2) not null check (condition_min >= 0 and condition_min <= 10),
  -- Mức hỗ trợ: một phần trăm học phí, hoặc toàn phần.
  support_type text not null check (support_type in ('percent', 'full')),
  support_percent numeric(5, 2) check (support_percent > 0 and support_percent <= 100),
  created_at timestamptz not null default now(),
  check (
    (support_type = 'percent' and support_percent is not null)
    or (support_type = 'full' and support_percent is null)
  ),
  check (condition_metric <> 'ielts' or condition_min <= 9)
);

create unique index scholarships_school_name_key
  on public.scholarships (school_id, lower(btrim(name)));
create index scholarships_school_idx on public.scholarships (school_id);

alter table public.scholarships enable row level security;

revoke all on table public.scholarships from anon, authenticated;
grant select on table public.scholarships to anon, authenticated;

create policy "scholarships are publicly readable" on public.scholarships
  for select to anon, authenticated using (true);

grant select, insert, update, delete on table public.scholarships to service_role;

comment on table public.scholarships is 'Học bổng theo trường (điều kiện tối thiểu + mức hỗ trợ). CÔNG KHAI: ai cũng đọc được; chỉ server được ghi.';

insert into public.scholarships (school_id, name, condition_metric, condition_min, support_type, support_percent)
select s.id, v.name, v.metric, v.min_value, v.stype, v.pct
from (
  values
    ('Đại học Deakin', 'Merit Deakin', 'gpa', 8.0::numeric, 'percent', 25::numeric),
    ('Đại học Swinburne', 'Global Excellence', 'ielts', 7.0::numeric, 'percent', 20::numeric),
    ('Đại học Melbourne', 'Chancellor''s Scholarship', 'gpa', 9.0::numeric, 'full', null::numeric),
    ('Đại học Auckland', 'International Excellence', 'gpa', 7.5::numeric, 'percent', 15::numeric)
) as v(school_name, name, metric, min_value, stype, pct)
join public.schools s on s.name = v.school_name
on conflict do nothing;
