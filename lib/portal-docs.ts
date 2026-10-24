// Logic THUẦN (không import gì) cho hồ sơ học viên: làm sạch dữ liệu Gemini trích xuất và kiểm tra đủ/thiếu/hợp lệ.
// Việc kiểm tra ở đây là code thường, KHÔNG hỏi lại AI: chỉ xét "có đọc được thông tin cần thiết từ file hay không"
// cùng vài phép kiểm tra nhất quán đơn giản. Test trực tiếp bằng Node.

export type DocType = "transcript" | "ielts" | "identity";
export const DOC_TYPES: readonly DocType[] = ["transcript", "ielts", "identity"];

export const DOC_LABELS: Record<DocType, string> = {
  transcript: "Bảng điểm (PDF)",
  ielts: "Ảnh chứng chỉ IELTS",
  identity: "Ảnh CMND/CCCD hoặc hộ chiếu",
};

/** Tên gọi dùng giữa câu. */
export const DOC_SHORT_NAMES: Record<DocType, string> = {
  transcript: "bảng điểm",
  ielts: "chứng chỉ IELTS",
  identity: "CMND/CCCD/hộ chiếu",
};

export interface DocFields {
  fullName: string | null;
  /** Ngày dạng YYYY-MM-DD. */
  dateOfBirth: string | null;
  gpa: number | null;
  /** Thang điểm tối đa của điểm tổng kết (4, 5, 10 hoặc 100). */
  gpaScale: number | null;
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
  testDate: string | null;
  documentNumber: string | null;
}

export type FieldKey = keyof DocFields;

export const EMPTY_FIELDS: DocFields = {
  fullName: null,
  dateOfBirth: null,
  gpa: null,
  gpaScale: null,
  listening: null,
  reading: null,
  writing: null,
  speaking: null,
  overall: null,
  testDate: null,
  documentNumber: null,
};

/** Tên trường dùng trong thông báo lỗi, theo từng loại giấy tờ. */
export const FIELD_LABELS: Record<DocType, Partial<Record<FieldKey, string>>> = {
  transcript: {
    fullName: "họ tên",
    dateOfBirth: "ngày sinh",
    gpa: "điểm học tập tổng kết",
    gpaScale: "thang điểm của điểm tổng kết (ví dụ thang 10 hay thang 4)",
  },
  ielts: {
    fullName: "họ tên trên chứng chỉ",
    listening: "điểm Nghe (Listening)",
    reading: "điểm Đọc (Reading)",
    writing: "điểm Viết (Writing)",
    speaking: "điểm Nói (Speaking)",
    overall: "điểm tổng (Overall)",
    testDate: "ngày thi",
  },
  identity: {
    fullName: "họ tên",
    dateOfBirth: "ngày sinh",
    documentNumber: "số giấy tờ",
  },
};

/** Các trường BẮT BUỘC đọc được thì giấy tờ mới hợp lệ. */
export const REQUIRED_FIELDS: Record<DocType, readonly FieldKey[]> = {
  transcript: ["fullName", "dateOfBirth", "gpa", "gpaScale"],
  ielts: ["fullName", "listening", "reading", "writing", "speaking", "overall", "testDate"],
  identity: ["fullName", "dateOfBirth", "documentNumber"],
};

/** Lời khuyên chung khi phải nộp lại; giao diện hiện MỘT lần dưới danh sách lý do (không lặp trong từng lý do). */
export const RESUBMIT_TIPS =
  "Hãy chụp/quét lại rõ nét hơn (đủ sáng, không bị chói hoặc cắt mép, đặt giấy tờ phẳng) rồi nộp lại.";

// ---------------------------------------------------------------------------------------------
// Làm sạch dữ liệu thô do Gemini trả về
// ---------------------------------------------------------------------------------------------

const PLACEHOLDER =
  /^(null|none|n\/a|na|unknown|undefined|không rõ|không có|chưa rõ|không đọc được|unreadable|illegible|—|-|\.+)$/i;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || PLACEHOLDER.test(text)) return null;
  return text.slice(0, max);
}

function cleanDocumentNumber(value: unknown): string | null {
  const text = cleanText(value, 64);
  if (!text) return null;
  const cleaned = text.replace(/[^A-Za-z0-9 ./-]/g, "").trim();
  return cleaned.replace(/[^A-Za-z0-9]/g, "").length >= 5 ? cleaned : null;
}

function isRealDate(y: number, m: number, d: number) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Nhận "YYYY-MM-DD" hoặc "DD/MM/YYYY" (cũng "-" hoặc "."), trả về "YYYY-MM-DD" nếu là ngày có thật. */
export function parseDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  let y: number, m: number, d: number;
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  if (y < 1900 || y > 2100 || !isRealDate(y, m, d)) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const n = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(n) ? n : null;
}

/** Điểm band IELTS hợp lệ: 0-9, bước 0.5. Giá trị khác coi là đọc sai. */
function parseBand(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 0 && n <= 9 && Number.isInteger(n * 2) ? n : null;
}

const ALLOWED_GPA_SCALES = [4, 5, 10, 100];

/**
 * Chuyển JSON thô của Gemini (khoá snake_case) thành `DocFields`, chỉ giữ các trường thuộc loại giấy tờ đó.
 * Giá trị không hợp lệ (sai định dạng, ngoài khoảng cho phép) được đặt null thay vì đoán.
 */
export function sanitizeDocFields(type: DocType, raw: unknown): DocFields {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fields: DocFields = { ...EMPTY_FIELDS };

  fields.fullName = cleanText(r.full_name ?? r.fullName, 200);

  if (type === "transcript" || type === "identity") {
    fields.dateOfBirth = parseDate(r.date_of_birth ?? r.dateOfBirth);
  }
  if (type === "transcript") {
    const gpa = parseNumber(r.gpa);
    fields.gpa = gpa !== null && gpa > 0 && gpa <= 100 ? gpa : null;
    const scale = parseNumber(r.gpa_scale ?? r.gpaScale);
    fields.gpaScale = scale !== null && ALLOWED_GPA_SCALES.includes(scale) ? scale : null;
  }
  if (type === "ielts") {
    fields.listening = parseBand(r.listening);
    fields.reading = parseBand(r.reading);
    fields.writing = parseBand(r.writing);
    fields.speaking = parseBand(r.speaking);
    fields.overall = parseBand(r.overall);
    fields.testDate = parseDate(r.test_date ?? r.testDate);
  }
  if (type === "identity") {
    fields.documentNumber = cleanDocumentNumber(r.document_number ?? r.documentNumber);
  }
  return fields;
}

// ---------------------------------------------------------------------------------------------
// Kiểm tra đủ/thiếu/hợp lệ (code thường)
// ---------------------------------------------------------------------------------------------

/** Điểm tổng IELTS đúng theo quy tắc: trung bình 4 kỹ năng làm tròn đến 0.5 (0.25 lên 0.5, 0.75 lên 1.0). */
export function expectedIeltsOverall(l: number, r: number, w: number, s: number): number {
  const sumHalfBands = Math.round(l * 2) + Math.round(r * 2) + Math.round(w * 2) + Math.round(s * 2);
  return Math.floor((sumHalfBands + 2) / 4) / 2;
}

export type DocStatus = "chua_nop" | "hop_le" | "can_nop_lai";

export interface DocEvaluation {
  status: "hop_le" | "can_nop_lai";
  /** Lý do cụ thể, tiếng Việt; rỗng nếu hợp lệ. */
  problems: string[];
  /** Các trường bắt buộc nhưng không đọc được. */
  missingFields: FieldKey[];
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** Một giấy tờ đã nộp có hợp lệ không? `today` để test ngày tháng. */
export function evaluateDocument(type: DocType, fields: DocFields, today: Date = new Date()): DocEvaluation {
  const required = REQUIRED_FIELDS[type];
  const labels = FIELD_LABELS[type];
  const missingFields = required.filter((k) => fields[k] === null);
  const problems: string[] = [];

  if (missingFields.length === required.length) {
    problems.push(
      `Không đọc được thông tin nào từ file này. Có thể ảnh bị mờ, thiếu sáng, bị cắt mép hoặc đây không phải ${DOC_SHORT_NAMES[type]}.`,
    );
  } else if (missingFields.length > 0) {
    problems.push(`Không đọc được: ${missingFields.map((k) => labels[k]).join(", ")}.`);
  }

  const todayIso = today.toISOString().slice(0, 10);

  if (fields.dateOfBirth !== null && (fields.dateOfBirth > todayIso || fields.dateOfBirth < "1920-01-01")) {
    problems.push(`Ngày sinh đọc được (${fields.dateOfBirth}) không hợp lệ, có thể bị đọc sai.`);
  }
  if (fields.testDate !== null && fields.testDate > todayIso) {
    problems.push(`Ngày thi đọc được (${fields.testDate}) nằm ở tương lai, có thể bị đọc sai.`);
  }

  if (type === "transcript" && fields.gpa !== null && fields.gpaScale !== null && fields.gpa > fields.gpaScale) {
    problems.push(
      `Điểm tổng kết đọc được (${fmt(fields.gpa)}) lớn hơn thang điểm (${fields.gpaScale}), có thể bị đọc sai.`,
    );
  }

  if (
    type === "ielts" &&
    fields.listening !== null &&
    fields.reading !== null &&
    fields.writing !== null &&
    fields.speaking !== null &&
    fields.overall !== null
  ) {
    const expected = expectedIeltsOverall(fields.listening, fields.reading, fields.writing, fields.speaking);
    if (expected !== fields.overall) {
      problems.push(
        `Điểm tổng ${fmt(fields.overall)} không khớp với 4 điểm kỹ năng (trung bình làm tròn ra ${fmt(expected)}), có thể một điểm bị đọc sai.`,
      );
    }
  }

  return { status: problems.length ? "can_nop_lai" : "hop_le", problems, missingFields };
}

export interface ProfileEvaluation {
  docs: Record<DocType, { status: DocStatus; problems: string[] }>;
  /** Đủ cả 3 giấy tờ và cả 3 đều hợp lệ. */
  complete: boolean;
  /** Giấy tờ chưa nộp. */
  missing: DocType[];
  /** Giấy tờ đã nộp nhưng không hợp lệ, kèm lý do. */
  invalid: { type: DocType; problems: string[] }[];
  /** Câu tóm tắt tình trạng hồ sơ. */
  headline: string;
}

export function evaluateProfile(
  docs: Partial<Record<DocType, DocFields | null | undefined>>,
  today: Date = new Date(),
): ProfileEvaluation {
  const result = {} as ProfileEvaluation["docs"];
  const missing: DocType[] = [];
  const invalid: ProfileEvaluation["invalid"] = [];

  for (const type of DOC_TYPES) {
    const fields = docs[type];
    if (!fields) {
      result[type] = { status: "chua_nop", problems: [] };
      missing.push(type);
      continue;
    }
    const evaluation = evaluateDocument(type, fields, today);
    result[type] = { status: evaluation.status, problems: evaluation.problems };
    if (evaluation.status === "can_nop_lai") invalid.push({ type, problems: evaluation.problems });
  }

  const complete = missing.length === 0 && invalid.length === 0;
  const parts: string[] = [];
  if (missing.length) parts.push(`còn thiếu ${missing.map((t) => DOC_SHORT_NAMES[t]).join(", ")}`);
  if (invalid.length) parts.push(`cần nộp lại ${invalid.map((i) => DOC_SHORT_NAMES[i.type]).join(", ")}`);
  const headline = complete ? "Hồ sơ đã đủ 3 giấy tờ và đều hợp lệ." : `Hồ sơ chưa hoàn tất: ${parts.join("; ")}.`;

  return { docs: result, complete, missing, invalid, headline };
}
