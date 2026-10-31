import "server-only";

import { adminDb, StorageError } from "@/lib/chat-store";
import { DOC_TYPES, evaluateProfile, type DocFields, type DocStatus, type DocType } from "@/lib/portal-docs";
import { docRowToStored, STUDENT_DOC_COLUMNS, type StoredStudentDoc } from "@/lib/student-store";
import { createAuthClient } from "@/lib/supabase-auth";

// Quản trị hồ sơ học viên (DỮ LIỆU RIÊNG TƯ có PII). Cả ĐỌC lẫn SỬA/XOÁ đều chạy bằng PHIÊN CỦA NGƯỜI DÙNG đang đăng nhập (không phải
// secret key) nên RLS ở database quyết định theo vai trò (migration role_based_rls_admin_staff):
//   - admin và nhân viên: xem mọi hồ sơ;  - chỉ admin: sửa và xoá.  Học viên thường không đọc được hồ sơ của người khác.
// Chỉ phần tra email (bảng auth.users, không truy cập được bằng REST) dùng secret key.
// Nơi gọi vẫn phải kiểm tra quyền (`requireStaff()` / `checkAdminWrite()`) để báo lỗi rõ ràng và chặn sớm.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isProfileId = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

const LIST_LIMIT = 200;

export interface AdminProfileSummary {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  docs: Record<DocType, DocStatus>;
  complete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProfileDetail {
  id: string;
  userId: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  documents: Partial<Record<DocType, StoredStudentDoc>>;
}

interface ProfileRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

function docFieldsOf(documents: Partial<Record<DocType, StoredStudentDoc>>): Partial<Record<DocType, DocFields>> {
  const out: Partial<Record<DocType, DocFields>> = {};
  for (const type of DOC_TYPES) if (documents[type]) out[type] = documents[type]!.fields;
  return out;
}

function nameOf(documents: Partial<Record<DocType, StoredStudentDoc>>): string | null {
  return documents.identity?.fields.fullName ?? documents.transcript?.fields.fullName ?? documents.ielts?.fields.fullName ?? null;
}

async function emailsByUserId(): Promise<Map<string, string | null>> {
  const { data, error } = await adminDb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new StorageError("list auth users", error);
  return new Map(data.users.map((u) => [u.id, u.email ?? null]));
}

/** Danh sách hồ sơ học viên (mới cập nhật trước), kèm trạng thái 3 giấy tờ tính bằng code thường. */
export async function listProfilesForAdmin(): Promise<AdminProfileSummary[]> {
  const db = await createAuthClient();
  const { data: profiles, error } = await db
    .from("student_profiles")
    .select("id, user_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new StorageError("list student profiles", error);
  if (!profiles?.length) return [];

  const { data: rows, error: docsError } = await db
    .from("student_documents")
    .select(`profile_id, ${STUDENT_DOC_COLUMNS}`)
    .in("profile_id", profiles.map((p) => p.id));
  if (docsError) throw new StorageError("list student documents", docsError);

  const byProfile = new Map<string, Partial<Record<DocType, StoredStudentDoc>>>();
  for (const row of (rows ?? []) as unknown as { profile_id: string; doc_type: DocType }[]) {
    const docs = byProfile.get(row.profile_id) ?? {};
    if (DOC_TYPES.includes(row.doc_type)) docs[row.doc_type] = docRowToStored(row);
    byProfile.set(row.profile_id, docs);
  }

  const emails = await emailsByUserId();
  return (profiles as ProfileRow[]).map((p) => {
    const documents = byProfile.get(p.id) ?? {};
    const evaluation = evaluateProfile(docFieldsOf(documents));
    return {
      id: p.id,
      userId: p.user_id,
      email: emails.get(p.user_id) ?? null,
      name: nameOf(documents),
      docs: { transcript: evaluation.docs.transcript.status, ielts: evaluation.docs.ielts.status, identity: evaluation.docs.identity.status },
      complete: evaluation.complete,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  });
}

/** Một hồ sơ kèm giấy tờ; null nếu id sai, không tồn tại, hoặc người gọi không có quyền xem (RLS trả về rỗng). */
export async function getProfileForAdmin(id: string): Promise<AdminProfileDetail | null> {
  if (!isProfileId(id)) return null;
  const db = await createAuthClient();
  const { data: profile, error } = await db
    .from("student_profiles")
    .select("id, user_id, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new StorageError("get student profile", error);
  if (!profile) return null;

  const { data: rows, error: docsError } = await db.from("student_documents").select(STUDENT_DOC_COLUMNS).eq("profile_id", id);
  if (docsError) throw new StorageError("get student documents", docsError);

  const documents: AdminProfileDetail["documents"] = {};
  for (const row of (rows ?? []) as unknown as { doc_type: DocType }[]) {
    if (DOC_TYPES.includes(row.doc_type)) documents[row.doc_type] = docRowToStored(row);
  }

  const { data: user, error: userError } = await adminDb().auth.admin.getUserById(profile.user_id);
  if (userError) console.error("[admin-student-store] Không tra được email học viên:", userError.message);
  const p = profile as ProfileRow;
  return { id: p.id, userId: p.user_id, email: user?.user?.email ?? null, createdAt: p.created_at, updatedAt: p.updated_at, documents };
}

/**
 * Sửa thông tin của MỘT giấy tờ đã nộp (admin sửa tay chỗ AI đọc sai). Trả về false nếu không có hàng nào bị đổi: giấy tờ không tồn tại
 * HOẶC database từ chối vì người gọi không phải admin (RLS). Đánh dấu `model = "admin_edit"` để biết dữ liệu đã được sửa tay,
 * và xoá gợi ý học bổng đã lưu đệm của hồ sơ (điểm đổi thì gợi ý cũ không còn đúng).
 */
export async function updateDocumentByAdmin(profileId: string, type: DocType, fields: DocFields): Promise<boolean> {
  if (!isProfileId(profileId) || !DOC_TYPES.includes(type)) return false;
  const db = await createAuthClient();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("student_documents")
    .update({
      full_name: fields.fullName,
      date_of_birth: fields.dateOfBirth,
      gpa: fields.gpa,
      gpa_scale: fields.gpaScale,
      ielts_listening: fields.listening,
      ielts_reading: fields.reading,
      ielts_writing: fields.writing,
      ielts_speaking: fields.speaking,
      ielts_overall: fields.overall,
      test_date: fields.testDate,
      document_number: fields.documentNumber,
      model: "admin_edit",
      extracted_at: now,
    })
    .eq("profile_id", profileId)
    .eq("doc_type", type)
    .select("profile_id");
  if (error) throw new StorageError("update student document", error);
  if (!data?.length) return false;

  const { error: touchError } = await db
    .from("student_profiles")
    .update({ updated_at: now, scholarship_suggestions: null, scholarship_input_hash: null, scholarship_generated_at: null })
    .eq("id", profileId);
  if (touchError) throw new StorageError("touch student profile", touchError);
  return true;
}

/** Xoá VĨNH VIỄN hồ sơ và mọi giấy tờ của nó (on delete cascade). false nếu không tồn tại hoặc người gọi không phải admin (RLS). */
export async function deleteProfileByAdmin(profileId: string): Promise<boolean> {
  if (!isProfileId(profileId)) return false;
  const { data, error } = await (await createAuthClient()).from("student_profiles").delete().eq("id", profileId).select("id");
  if (error) throw new StorageError("delete student profile", error);
  return (data?.length ?? 0) > 0;
}
