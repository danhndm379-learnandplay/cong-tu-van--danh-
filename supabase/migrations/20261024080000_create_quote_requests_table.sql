-- Yêu cầu báo giá của khách hàng, để admin xem lại sau.
-- Chứa thông tin cá nhân của khách (tên, email): RIÊNG TƯ, chỉ server (service_role) được truy cập.

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  study_country text not null check (char_length(btrim(study_country)) between 1 and 200),
  education_level text not null check (education_level in ('thpt', 'dai_hoc', 'thac_si')),
  service_package text not null check (service_package in ('co_ban', 'toan_dien')),
  -- Giá (VND) tại thời điểm báo, lưu cố định để đổi bảng giá sau này không làm sai yêu cầu cũ.
  price bigint not null check (price >= 0),
  status text not null default 'cho_duyet' check (status in ('cho_duyet', 'da_duyet', 'tu_choi')),
  created_at timestamptz not null default now()
);

create index quote_requests_status_created_idx on public.quote_requests (status, created_at desc);
create index quote_requests_created_idx on public.quote_requests (created_at desc);

alter table public.quote_requests enable row level security;

revoke all on table public.quote_requests from anon, authenticated;

create policy "no browser access" on public.quote_requests
  for all to anon, authenticated using (false) with check (false);

grant select, insert, update, delete on table public.quote_requests to service_role;

comment on table public.quote_requests is 'Yêu cầu báo giá của khách (có PII). RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
