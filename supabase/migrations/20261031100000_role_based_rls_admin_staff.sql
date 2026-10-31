-- Phân quyền theo VAI TRÒ ở tầng database cho khu quản trị.
--
-- Vai trò lưu ở App Metadata của tài khoản (auth.users.raw_app_meta_data -> 'role') và có trong token đăng nhập (JWT claim
-- app_metadata.role). Chỉ server (secret key) hoặc Supabase Dashboard sửa được App Metadata, người dùng tự sửa thì không
-- (khác User Metadata). Hai vai trò:
--   'admin'    : xem, sửa, xoá dữ liệu hồ sơ học viên, xoá hội thoại, xử lý yêu cầu báo giá, trích xuất lead.
--   'nhan_vien': CHỈ XEM. Không có chính sách UPDATE/DELETE/INSERT nào cho vai trò này nên database từ chối dù gọi thẳng.
-- Học viên (đăng nhập magic link, không có vai trò) và người chưa đăng nhập không đụng được vào dữ liệu quản trị.
--
-- Điều kiện để RLS có tác dụng: code phải chạy các thao tác sửa/xoá bằng PHIÊN CỦA NGƯỜI DÙNG (role `authenticated`, kèm token),
-- không phải secret key (role service_role bỏ qua RLS). Các thao tác của khách/chatbot/AI vẫn đi bằng secret key.
-- Lưu ý: vai trò được đọc từ token nên đổi vai trò chỉ có hiệu lực sau khi token mới được cấp (đăng nhập lại hoặc tối đa ~1 giờ).

-- ========== Hội thoại chatbot ==========
drop policy "no browser access" on public.conversations;
drop policy "no browser access" on public.messages;

create policy "anon: không có quyền" on public.conversations for all to anon using (false) with check (false);
create policy "anon: không có quyền" on public.messages for all to anon using (false) with check (false);

grant select, delete on table public.conversations to authenticated;
grant select on table public.messages to authenticated; -- tin nhắn chỉ bị xoá theo cuộc trò chuyện (on delete cascade)

create policy "admin và nhân viên được xem" on public.conversations
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));
create policy "chỉ admin được xoá" on public.conversations
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "admin và nhân viên được xem" on public.messages
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));

-- ========== Lead trích xuất từ hội thoại ==========
drop policy "no browser access" on public.leads;
create policy "anon: không có quyền" on public.leads for all to anon using (false) with check (false);

grant select, insert, update, delete on table public.leads to authenticated;

create policy "admin và nhân viên được xem" on public.leads
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));
create policy "chỉ admin được thêm" on public.leads
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "chỉ admin được sửa" on public.leads
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "chỉ admin được xoá" on public.leads
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- ========== Yêu cầu báo giá ==========
-- Khách gửi yêu cầu qua server (secret key) nên không cần quyền INSERT cho người dùng đăng nhập.
drop policy "no browser access" on public.quote_requests;
create policy "anon: không có quyền" on public.quote_requests for all to anon using (false) with check (false);

grant select, update, delete on table public.quote_requests to authenticated;

create policy "admin và nhân viên được xem" on public.quote_requests
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));
create policy "chỉ admin được sửa" on public.quote_requests
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "chỉ admin được xoá" on public.quote_requests
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

-- ========== Hồ sơ học viên ==========
-- Học viên vẫn chỉ đọc hồ sơ của mình (chính sách đã có); thêm: admin/nhân viên xem tất cả, chỉ admin sửa/xoá.
grant update, delete on table public.student_profiles to authenticated;
grant update, delete on table public.student_documents to authenticated;

create policy "admin và nhân viên được xem" on public.student_profiles
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));
create policy "chỉ admin được sửa" on public.student_profiles
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "chỉ admin được xoá" on public.student_profiles
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "admin và nhân viên được xem" on public.student_documents
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') in ('admin', 'nhan_vien'));
create policy "chỉ admin được sửa" on public.student_documents
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
create policy "chỉ admin được xoá" on public.student_documents
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');
