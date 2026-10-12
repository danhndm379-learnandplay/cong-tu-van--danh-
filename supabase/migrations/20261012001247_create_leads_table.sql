-- Lead trích xuất từ cuộc trò chuyện bằng Gemini (một lead cho mỗi cuộc trò chuyện).
-- Chứa thông tin cá nhân của khách (tên, email, số điện thoại): RIÊNG TƯ, chỉ server (service_role) được truy cập.
-- Xoá cuộc trò chuyện thì lead bị xoá theo (on delete cascade).

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  name text check (char_length(name) <= 200),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 40),
  study_country text check (char_length(study_country) <= 200),
  education_level text check (char_length(education_level) <= 200),
  major text check (char_length(major) <= 200),
  availability text check (char_length(availability) <= 500),
  -- true: khách đồng ý/yêu cầu đặt lịch tư vấn; false: khách từ chối; null: chưa rõ.
  wants_consultation boolean,
  note text check (char_length(note) <= 2000),
  quality text not null check (quality in ('good', 'ok', 'spam')),
  quality_reason text check (char_length(quality_reason) <= 500),
  -- Dấu vết lần trích xuất: id tin nhắn cuối cùng đã đọc, để biết lead có cũ hơn hội thoại không.
  source_message_id bigint,
  source_message_count integer,
  model text,
  extracted_at timestamptz not null default now()
);

create index leads_quality_idx on public.leads (quality, extracted_at desc);

alter table public.leads enable row level security;

revoke all on table public.leads from anon, authenticated;

create policy "no browser access" on public.leads
  for all to anon, authenticated using (false) with check (false);

grant select, insert, update, delete on table public.leads to service_role;

comment on table public.leads is 'Lead trích xuất từ hội thoại chatbot (có PII). RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
