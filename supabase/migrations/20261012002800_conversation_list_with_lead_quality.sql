-- Danh sách hội thoại cho admin: thêm chất lượng lead và lọc theo chất lượng.
-- p_quality: null = tất cả; 'good' | 'ok' | 'spam' = lọc theo chất lượng lead; 'none' = chưa trích xuất lead.
-- Giữ nguyên hai tham số đầu (p_limit, p_offset) và thêm p_quality có giá trị mặc định,
-- nên bản code cũ đang chạy trên Vercel (chỉ truyền p_limit/p_offset) vẫn gọi được.

drop function public.list_conversations_for_admin(int, int);

create function public.list_conversations_for_admin(
  p_limit int default 20,
  p_offset int default 0,
  p_quality text default null
)
returns table (
  id uuid,
  created_at timestamptz,
  last_message_at timestamptz,
  message_count bigint,
  first_user_message text,
  lead_quality text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.created_at,
    c.last_message_at,
    (select count(*) from public.messages m where m.conversation_id = c.id),
    (select m.content from public.messages m
       where m.conversation_id = c.id and m.role = 'user'
       order by m.id limit 1),
    l.quality
  from public.conversations c
  left join public.leads l on l.conversation_id = c.id
  where p_quality is null
     or (p_quality = 'none' and l.id is null)
     or l.quality = p_quality
  order by c.last_message_at desc, c.id
  limit greatest(p_limit, 0) offset greatest(p_offset, 0)
$$;

create function public.count_conversations_for_admin(p_quality text default null)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
  from public.conversations c
  left join public.leads l on l.conversation_id = c.id
  where p_quality is null
     or (p_quality = 'none' and l.id is null)
     or l.quality = p_quality
$$;

-- Hàm trong schema public mặc định gọi được qua REST /rpc: thu hồi với trình duyệt, chỉ service_role được gọi.
revoke execute on function public.list_conversations_for_admin(int, int, text) from public, anon, authenticated;
grant execute on function public.list_conversations_for_admin(int, int, text) to service_role;
revoke execute on function public.count_conversations_for_admin(text) from public, anon, authenticated;
grant execute on function public.count_conversations_for_admin(text) to service_role;
