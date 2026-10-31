import { sanitizeDocFields, type DocFields, type DocType, type FieldKey } from "@/lib/portal-docs";

// Form admin sửa thông tin giấy tờ của học viên: các ô theo từng loại giấy tờ và kiểm tra giá trị nhập.
// Dùng chung cho giao diện (client) và Server Action (server). Không có import runtime nào ngoài portal-docs (thuần).

export interface EditableField {
  key: FieldKey;
  label: string;
  kind: "text" | "date" | "number" | "band" | "scale";
}

export const GPA_SCALE_OPTIONS = [4, 5, 10, 100] as const;

export const EDITABLE_FIELDS: Record<DocType, EditableField[]> = {
  transcript: [
    { key: "fullName", label: "Họ tên", kind: "text" },
    { key: "dateOfBirth", label: "Ngày sinh", kind: "date" },
    { key: "gpa", label: "Điểm tổng kết", kind: "number" },
    { key: "gpaScale", label: "Thang điểm", kind: "scale" },
  ],
  ielts: [
    { key: "fullName", label: "Họ tên", kind: "text" },
    { key: "listening", label: "Nghe (Listening)", kind: "band" },
    { key: "reading", label: "Đọc (Reading)", kind: "band" },
    { key: "writing", label: "Viết (Writing)", kind: "band" },
    { key: "speaking", label: "Nói (Speaking)", kind: "band" },
    { key: "overall", label: "Điểm tổng (Overall)", kind: "band" },
    { key: "testDate", label: "Ngày thi", kind: "date" },
  ],
  identity: [
    { key: "fullName", label: "Họ tên", kind: "text" },
    { key: "dateOfBirth", label: "Ngày sinh", kind: "date" },
    { key: "documentNumber", label: "Số giấy tờ", kind: "text" },
  ],
};

export type ParsedDocForm = { ok: true; fields: DocFields } | { ok: false; errors: string[] };

/**
 * Chuyển giá trị nhập (chuỗi) thành `DocFields` đã làm sạch. Ô để trống = không có giá trị (null). Ô có nhập mà không hợp lệ
 * (ngày không có thật, điểm IELTS không phải 0-9 bước 0.5, thang điểm lạ...) thì trả lỗi, KHÔNG lặng lẽ bỏ giá trị.
 * Việc đủ/thiếu/đáng ngờ của giấy tờ vẫn do `evaluateDocument` đánh giá sau khi lưu, nên admin được lưu cả khi còn thiếu trường.
 */
export function parseDocForm(type: DocType, get: (name: string) => string | null): ParsedDocForm {
  const raw: Record<string, string> = {};
  for (const field of EDITABLE_FIELDS[type]) raw[field.key] = (get(field.key) ?? "").trim();

  const fields = sanitizeDocFields(type, raw);
  const errors = EDITABLE_FIELDS[type]
    .filter((field) => raw[field.key] !== "" && fields[field.key] === null)
    .map((field) => `${field.label} không hợp lệ.`);
  return errors.length ? { ok: false, errors } : { ok: true, fields };
}
