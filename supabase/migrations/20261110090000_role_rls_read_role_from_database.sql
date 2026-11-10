-- RLS theo vai trò: đọc vai trò HIỆN TẠI từ database thay vì từ token đăng nhập.
--
-- Trước đây các chính sách đọc `auth.jwt() -> 'app_metadata' ->> 'role'` (vai trò nằm trong token). Token sống tới ~1 giờ nên admin vừa
-- bị hạ quyền (hoặc bị khoá/xoá tài khoản) vẫn gọi thẳng REST bằng token cũ để sửa/xoá dữ liệu trong khoảng đó.
-- Giờ mỗi chính sách hỏi hàm private.staff_role(), tra thẳng `auth.users` của người đang gọi, nên đổi vai trò, khoá hay xoá tài khoản
-- có hiệu lực NGAY ở database. Thăng quyền cũng có hiệu lực ngay (không cần đăng nhập lại).
--
-- Vẫn chỉ `app_metadata` (người dùng KHÔNG tự sửa được) mới quyết định quyền; `user_metadata` không bao giờ được đọc.
-- Hàm nằm ở schema `private` (không được PostgREST công khai thành API) và chỉ trả vai trò của chính người gọi.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.raw_app_meta_data ->> 'role'
  from auth.users u
  where u.id = (select auth.uid())
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
$$;

revoke all on function private.staff_role() from public, anon;
grant execute on function private.staff_role() to authenticated;

-- ========== Hội thoại chatbot ==========
alter policy "admin và nhân viên được xem" on public.conversations
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));
alter policy "chỉ admin được xoá" on public.conversations
  using ((select private.staff_role()) = 'admin');
alter policy "admin và nhân viên được xem" on public.messages
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));

-- ========== Lead ==========
alter policy "admin và nhân viên được xem" on public.leads
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));
alter policy "chỉ admin được thêm" on public.leads
  with check ((select private.staff_role()) = 'admin');
alter policy "chỉ admin được sửa" on public.leads
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');
alter policy "chỉ admin được xoá" on public.leads
  using ((select private.staff_role()) = 'admin');

-- ========== Yêu cầu báo giá ==========
alter policy "admin và nhân viên được xem" on public.quote_requests
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));
alter policy "chỉ admin được sửa" on public.quote_requests
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');
alter policy "chỉ admin được xoá" on public.quote_requests
  using ((select private.staff_role()) = 'admin');

-- ========== Hồ sơ học viên (chính sách "học viên chỉ đọc hồ sơ của mình" giữ nguyên) ==========
alter policy "admin và nhân viên được xem" on public.student_profiles
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));
alter policy "chỉ admin được sửa" on public.student_profiles
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');
alter policy "chỉ admin được xoá" on public.student_profiles
  using ((select private.staff_role()) = 'admin');

alter policy "admin và nhân viên được xem" on public.student_documents
  using ((select private.staff_role()) in ('admin', 'nhan_vien'));
alter policy "chỉ admin được sửa" on public.student_documents
  using ((select private.staff_role()) = 'admin')
  with check ((select private.staff_role()) = 'admin');
alter policy "chỉ admin được xoá" on public.student_documents
  using ((select private.staff_role()) = 'admin');
