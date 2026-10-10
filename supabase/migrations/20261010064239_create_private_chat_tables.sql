-- Lịch sử chat của khách: dữ liệu riêng tư, chỉ server (service_role) được truy cập.
-- Trình duyệt (anon/authenticated) bị chặn hoàn toàn: RLS bật + không có policy cho phép + thu hồi quyền bảng.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  -- sha256 của token trong cookie httpOnly của khách; không lưu token gốc.
  visitor_token_hash text not null check (char_length(visitor_token_hash) = 64),
  channel text not null default 'web' check (channel in ('web')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index conversations_visitor_idx
  on public.conversations (visitor_token_hash, last_message_at desc);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'bot')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, id);

-- Mỗi tin nhắn mới cập nhật last_message_at của cuộc trò chuyện.
create function public.touch_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.touch_conversation() from public, anon, authenticated;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- RLS: bật cho cả hai bảng.
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Thu hồi mọi quyền của vai trò dùng ở trình duyệt (phòng thủ nhiều lớp, ngoài RLS).
revoke all on table public.conversations from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on sequence public.messages_id_seq from anon, authenticated;

-- Policy tường minh: anon/authenticated KHÔNG được làm gì trên hai bảng này.
create policy "no browser access" on public.conversations
  for all to anon, authenticated using (false) with check (false);
create policy "no browser access" on public.messages
  for all to anon, authenticated using (false) with check (false);

-- Chỉ service_role (secret key, chạy trên server) được đọc/ghi; service_role bỏ qua RLS.
grant select, insert, update, delete on table public.conversations to service_role;
grant select, insert, update, delete on table public.messages to service_role;
grant usage, select on sequence public.messages_id_seq to service_role;

comment on table public.conversations is 'Cuộc trò chuyện chatbot của khách. RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
comment on table public.messages is 'Tin nhắn trong cuộc trò chuyện chatbot. RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
