import "server-only";

import { adminDb, hashVisitorToken, isValidVisitorToken, newVisitorToken, StorageError } from "@/lib/chat-store";
import { DOC_TYPES, EMPTY_FIELDS, type DocFields, type DocType } from "@/lib/portal-docs";

// Hồ sơ học viên (bảng `student_profiles` + `student_documents`): DỮ LIỆU RIÊNG TƯ có PII (họ tên, ngày sinh, số giấy tờ).
// RLS bật, anon/authenticated bị chặn hoàn toàn; chỉ truy cập từ server bằng secret key qua `adminDb()`.
// Học viên được nhận diện bằng cookie httpOnly (chưa có đăng nhập, sẽ thay bằng Supabase Auth ở Tuần 6); DB chỉ lưu sha256 của token.
// File gốc KHÔNG được lưu, chỉ lưu thông tin đã trích xuất và siêu dữ liệu file.

export const STUDENT_COOKIE = "duhoc24_student";
export const STUDENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export { hashVisitorToken as hashStudentToken, isValidVisitorToken as isValidStudentToken, newVisitorToken as newStudentToken };

export interface StoredStudentDoc {
  type: DocType;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fields: DocFields;
  model: string | null;
  extractedAt: string;
}

interface DocRow {
  doc_type: DocType;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  full_name: string | null;
  date_of_birth: string | null;
  gpa: number | string | null;
  gpa_scale: number | string | null;
  ielts_listening: number | string | null;
  ielts_reading: number | string | null;
  ielts_writing: number | string | null;
  ielts_speaking: number | string | null;
  ielts_overall: number | string | null;
  test_date: string | null;
  document_number: string | null;
  model: string | null;
  extracted_at: string;
}

const DOC_COLUMNS =
  "doc_type, file_name, mime_type, size_bytes, full_name, date_of_birth, gpa, gpa_scale, ielts_listening, ielts_reading, ielts_writing, ielts_speaking, ielts_overall, test_date, document_number, model, extracted_at";

const num = (v: number | string | null) => (v === null ? null : Number(v));

function toStoredDoc(row: DocRow): StoredStudentDoc {
  return {
    type: row.doc_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    fields: {
      ...EMPTY_FIELDS,
      fullName: row.full_name,
      dateOfBirth: row.date_of_birth,
      gpa: num(row.gpa),
      gpaScale: num(row.gpa_scale),
      listening: num(row.ielts_listening),
      reading: num(row.ielts_reading),
      writing: num(row.ielts_writing),
      speaking: num(row.ielts_speaking),
      overall: num(row.ielts_overall),
      testDate: row.test_date,
      documentNumber: row.document_number,
    },
    model: row.model,
    extractedAt: row.extracted_at,
  };
}

export interface StudentSnapshot {
  profileId: string | null;
  documents: Partial<Record<DocType, StoredStudentDoc>>;
  scholarship: { suggestions: unknown; inputHash: string | null; generatedAt: string | null } | null;
}

/** Hồ sơ + giấy tờ của học viên đang giữ cookie này; rỗng nếu chưa có cookie hoặc chưa nộp gì. */
export async function loadStudentSnapshot(token: string | undefined): Promise<StudentSnapshot> {
  const empty: StudentSnapshot = { profileId: null, documents: {}, scholarship: null };
  if (!isValidVisitorToken(token)) return empty;

  const db = adminDb();
  const { data: profile, error } = await db
    .from("student_profiles")
    .select("id, scholarship_suggestions, scholarship_input_hash, scholarship_generated_at")
    .eq("owner_token_hash", hashVisitorToken(token))
    .maybeSingle();
  if (error) throw new StorageError("load student profile", error);
  if (!profile) return empty;

  const { data: rows, error: docsError } = await db
    .from("student_documents")
    .select(DOC_COLUMNS)
    .eq("profile_id", profile.id);
  if (docsError) throw new StorageError("load student documents", docsError);

  const documents: StudentSnapshot["documents"] = {};
  for (const row of (rows ?? []) as DocRow[]) {
    if (DOC_TYPES.includes(row.doc_type)) documents[row.doc_type] = toStoredDoc(row);
  }
  return {
    profileId: profile.id,
    documents,
    scholarship: {
      suggestions: profile.scholarship_suggestions,
      inputHash: profile.scholarship_input_hash,
      generatedAt: profile.scholarship_generated_at,
    },
  };
}

/** Tìm hồ sơ theo hash token, tạo mới nếu chưa có. Trả về id hồ sơ. */
export async function getOrCreateStudentProfile(tokenHash: string): Promise<string> {
  const db = adminDb();
  const { data: existing, error } = await db
    .from("student_profiles")
    .select("id")
    .eq("owner_token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new StorageError("find student profile", error);
  if (existing) return existing.id;

  const { data, error: insertError } = await db
    .from("student_profiles")
    .insert({ owner_token_hash: tokenHash })
    .select("id")
    .single();
  if (insertError) throw new StorageError("create student profile", insertError);
  return data.id;
}

/** Lưu (ghi đè) thông tin trích xuất của một loại giấy tờ. Giấy tờ mới thay thế giấy tờ cũ cùng loại. */
export async function saveStudentDocument(
  profileId: string,
  type: DocType,
  file: { name: string; mimeType: string; size: number },
  fields: DocFields,
  model: string,
): Promise<StoredStudentDoc> {
  const db = adminDb();
  const { data, error } = await db
    .from("student_documents")
    .upsert(
      {
        profile_id: profileId,
        doc_type: type,
        file_name: file.name.slice(0, 255),
        mime_type: file.mimeType,
        size_bytes: file.size,
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
        model,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,doc_type" },
    )
    .select(DOC_COLUMNS)
    .single();
  if (error) throw new StorageError("save student document", error);

  // Giấy tờ đổi thì gợi ý học bổng cũ không còn đúng: xoá bản lưu đệm để tạo lại.
  const { error: touchError } = await db
    .from("student_profiles")
    .update({ updated_at: new Date().toISOString(), scholarship_suggestions: null, scholarship_input_hash: null, scholarship_generated_at: null })
    .eq("id", profileId);
  if (touchError) throw new StorageError("touch student profile", touchError);

  return toStoredDoc(data as DocRow);
}

/** Lưu đệm gợi ý học bổng của AI cùng dấu vân tay đầu vào (để biết khi nào cần tạo lại). */
export async function saveScholarshipSuggestions(profileId: string, suggestions: unknown, inputHash: string): Promise<void> {
  const { error } = await adminDb()
    .from("student_profiles")
    .update({
      scholarship_suggestions: suggestions,
      scholarship_input_hash: inputHash,
      scholarship_generated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
  if (error) throw new StorageError("save scholarship suggestions", error);
}
