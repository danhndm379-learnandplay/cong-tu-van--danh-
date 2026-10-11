-- Danh sách hội thoại cho trang admin: kèm số tin nhắn và tin nhắn đầu tiên của khách.
-- Chỉ service_role (server) được gọi; anon/authenticated bị thu hồi quyền execute
-- (hàm trong schema public mặc định có thể gọi qua REST /rpc nếu không thu hồi).
create function public.list_conversations_for_admin(p_limit int default 20, p_offset int default 0)
returns table (
  id uuid,
  created_at timestamptz,
  last_message_at timestamptz,
  message_count bigint,
  first_user_message text
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
       order by m.id limit 1)
  from public.conversations c
  order by c.last_message_at desc, c.id
  limit greatest(p_limit, 0) offset greatest(p_offset, 0)
$$;

revoke execute on function public.list_conversations_for_admin(int, int) from public, anon, authenticated;
grant execute on function public.list_conversations_for_admin(int, int) to service_role;
