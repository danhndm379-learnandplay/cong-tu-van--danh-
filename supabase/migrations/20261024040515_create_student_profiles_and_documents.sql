-- Hồ sơ học viên và thông tin trích xuất từ giấy tờ (bảng điểm, IELTS, CMND/hộ chiếu).
-- DỮ LIỆU RIÊNG TƯ (có PII): RLS bật, anon/authenticated bị chặn hoàn toàn, chỉ server (service_role) truy cập.
-- File gốc KHÔNG được lưu: chỉ lưu thông tin đã trích xuất và siêu dữ liệu file (tên, loại, dung lượng).

create table public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  -- sha256 của token trong cookie httpOnly; không lưu token gốc.
  owner_token_hash text not null unique check (char_length(owner_token_hash) = 64),
  -- Gợi ý học bổng do AI tạo (lưu đệm) + dấu vân tay đầu vào để biết khi nào cần tạo lại.
  scholarship_suggestions jsonb,
  scholarship_input_hash text,
  scholarship_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.student_profiles (id) on delete cascade,
  doc_type text not null check (doc_type in ('transcript', 'ielts', 'identity')),
  -- Siêu dữ liệu file (không lưu nội dung file).
  file_name text check (char_length(file_name) <= 255),
  mime_type text check (char_length(mime_type) <= 100),
  size_bytes integer check (size_bytes >= 0),
  -- Thông tin trích xuất; trường nào không đọc được thì để null.
  full_name text check (char_length(full_name) <= 200),
  date_of_birth date,
  gpa numeric(6, 2) check (gpa >= 0),
  gpa_scale numeric(5, 1) check (gpa_scale > 0),
  ielts_listening numeric(2, 1) check (ielts_listening >= 0 and ielts_listening <= 9),
  ielts_reading numeric(2, 1) check (ielts_reading >= 0 and ielts_reading <= 9),
  ielts_writing numeric(2, 1) check (ielts_writing >= 0 and ielts_writing <= 9),
  ielts_speaking numeric(2, 1) check (ielts_speaking >= 0 and ielts_speaking <= 9),
  ielts_overall numeric(2, 1) check (ielts_overall >= 0 and ielts_overall <= 9),
  test_date date,
  document_number text check (char_length(document_number) <= 64),
  model text,
  extracted_at timestamptz not null default now(),
  unique (profile_id, doc_type)
);

alter table public.student_profiles enable row level security;
alter table public.student_documents enable row level security;

revoke all on table public.student_profiles from anon, authenticated;
revoke all on table public.student_documents from anon, authenticated;

create policy "no browser access" on public.student_profiles
  for all to anon, authenticated using (false) with check (false);
create policy "no browser access" on public.student_documents
  for all to anon, authenticated using (false) with check (false);

grant select, insert, update, delete on table public.student_profiles to service_role;
grant select, insert, update, delete on table public.student_documents to service_role;

comment on table public.student_profiles is 'Hồ sơ học viên (nhận diện bằng cookie httpOnly, lưu hash). RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
comment on table public.student_documents is 'Thông tin trích xuất từ giấy tờ học viên (có PII: họ tên, ngày sinh, số giấy tờ). RIÊNG TƯ: chỉ truy cập từ server bằng secret key.';
