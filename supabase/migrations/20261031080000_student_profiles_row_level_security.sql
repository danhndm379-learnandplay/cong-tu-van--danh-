-- Hồ sơ học viên gắn với TÀI KHOẢN ĐĂNG NHẬP và bảo vệ bằng RLS: mỗi người dùng chỉ đọc được hồ sơ của chính mình.
--
-- Trước đây hồ sơ nhận diện bằng cookie ẩn danh (owner_token_hash) và mọi truy vấn đi qua khoá server (bỏ qua RLS).
-- Nay: student_profiles.user_id = auth.users.id. Người dùng đã đăng nhập (role `authenticated`) CHỈ ĐƯỢC ĐỌC (select) hàng của mình;
-- không có quyền ghi: thông tin trích xuất từ giấy tờ do AI đọc và chỉ server (service_role) mới được ghi, để người dùng không tự sửa
-- điểm số. `anon` (chưa đăng nhập) không có quyền gì. Xoá tài khoản thì hồ sơ và giấy tờ xoá theo (on delete cascade).

do $$
begin
  if exists (select 1 from public.student_profiles) then
    raise exception 'Còn hồ sơ cũ gắn với cookie ẩn danh trong student_profiles, không thể gán cho tài khoản. Xử lý (xoá hoặc gán user_id) thủ công trước khi chạy migration này.';
  end if;
end $$;

alter table public.student_profiles drop column owner_token_hash;
alter table public.student_profiles
  add column user_id uuid not null unique references auth.users (id) on delete cascade;

-- Gỡ policy cũ ("chặn hết") và dựng policy mới.
drop policy "no browser access" on public.student_profiles;
drop policy "no browser access" on public.student_documents;

-- Chưa đăng nhập: không có quyền gì (đã revoke từ trước; policy này chỉ để rõ ý định).
create policy "anon: không có quyền" on public.student_profiles
  for all to anon using (false) with check (false);
create policy "anon: không có quyền" on public.student_documents
  for all to anon using (false) with check (false);

-- Đã đăng nhập: chỉ ĐỌC, chỉ hàng của mình.
grant select on table public.student_profiles to authenticated;
grant select on table public.student_documents to authenticated;

create policy "học viên chỉ đọc hồ sơ của mình" on public.student_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "học viên chỉ đọc giấy tờ của mình" on public.student_documents
  for select to authenticated
  using (
    exists (
      select 1
      from public.student_profiles p
      where p.id = student_documents.profile_id
        and p.user_id = (select auth.uid())
    )
  );

comment on table public.student_profiles is 'Hồ sơ học viên, một hồ sơ cho mỗi tài khoản (user_id). RLS: người dùng chỉ đọc được hồ sơ của mình; ghi chỉ từ server bằng secret key.';
comment on table public.student_documents is 'Thông tin trích xuất từ giấy tờ học viên (có PII: họ tên, ngày sinh, số giấy tờ). RLS: người dùng chỉ đọc được giấy tờ thuộc hồ sơ của mình; ghi chỉ từ server bằng secret key.';
