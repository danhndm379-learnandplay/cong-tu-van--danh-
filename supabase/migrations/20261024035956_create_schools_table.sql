-- Danh sách trường tham chiếu (điểm chuẩn) để đối chiếu hồ sơ học viên.
-- DỮ LIỆU CÔNG KHAI: ai cũng được ĐỌC (anon + authenticated). Thêm/sửa/xoá chỉ server (service_role) làm được.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  country text not null check (char_length(btrim(country)) between 1 and 100),
  -- Điểm học tập tối thiểu, thang 10.
  min_gpa numeric(4, 2) not null check (min_gpa >= 0 and min_gpa <= 10),
  -- Điểm IELTS tối thiểu, thang 0-9, bước 0.5.
  min_ielts numeric(2, 1) not null check (
    min_ielts >= 0 and min_ielts <= 9 and (min_ielts * 2) = round(min_ielts * 2)
  ),
  created_at timestamptz not null default now()
);

-- Không cho trùng (tên trường + quốc gia), không phân biệt hoa thường/khoảng trắng thừa.
create unique index schools_name_country_key
  on public.schools (lower(btrim(name)), lower(btrim(country)));

alter table public.schools enable row level security;

-- Quyền bảng: trình duyệt chỉ được SELECT; mọi thao tác ghi bị thu hồi (và cũng không có policy ghi nào).
revoke all on table public.schools from anon, authenticated;
grant select on table public.schools to anon, authenticated;

create policy "schools are publicly readable" on public.schools
  for select to anon, authenticated using (true);

grant select, insert, update, delete on table public.schools to service_role;

comment on table public.schools is 'Trường tham chiếu và điểm chuẩn tối thiểu (GPA thang 10, IELTS). CÔNG KHAI: ai cũng đọc được; chỉ server được ghi.';

insert into public.schools (name, country, min_gpa, min_ielts) values
  ('Đại học Deakin', 'Úc', 7.0, 6.0),
  ('Đại học Swinburne', 'Úc', 7.0, 6.0),
  ('Đại học Melbourne', 'Úc', 8.5, 7.0),
  ('Đại học Auckland', 'New Zealand', 7.5, 6.5)
on conflict do nothing;
