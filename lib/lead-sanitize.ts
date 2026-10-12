// Làm sạch và kiểm chứng kết quả trích xuất lead do model trả về. File thuần (không import gì) để test được trực tiếp.
//
// Nguyên tắc: không tin model. Email và số điện thoại chỉ được giữ nếu THỰC SỰ xuất hiện trong lời của khách
// (chặn việc model bịa, hoặc lấy nhầm hotline/địa chỉ của chatbot); "good" bắt buộc có ít nhất một thông tin liên hệ hợp lệ.

export type LeadQuality = "good" | "ok" | "spam";

/** Bộ lọc chất lượng ở trang danh sách: một mức chất lượng, hoặc "none" = chưa trích xuất lead. */
export type LeadQualityFilter = LeadQuality | "none";

export const LEAD_QUALITY_FILTERS: readonly LeadQualityFilter[] = ["good", "ok", "spam", "none"];

/** Đọc tham số `?quality=` từ URL; giá trị lạ trả về null (= không lọc). */
export function parseQualityFilter(value: unknown): LeadQualityFilter | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && (LEAD_QUALITY_FILTERS as readonly string[]).includes(v)
    ? (v as LeadQualityFilter)
    : null;
}

export interface Lead {
  name: string | null;
  email: string | null;
  phone: string | null;
  studyCountry: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  /** true: khách yêu cầu/đồng ý đặt lịch tư vấn; false: khách từ chối; null: chưa rõ. */
  wantsConsultation: boolean | null;
  note: string | null;
  quality: LeadQuality;
  qualityReason: string | null;
}

const MAX_LENGTH = {
  name: 200,
  email: 320,
  phone: 40,
  studyCountry: 200,
  educationLevel: 200,
  major: 200,
  availability: 500,
  note: 2000,
  qualityReason: 500,
} as const;

const PLACEHOLDER =
  /^(null|none|n\/a|na|unknown|undefined|không rõ|không có|chưa rõ|chưa có|chưa cung cấp|không cung cấp|—|-|\.+)$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || PLACEHOLDER.test(text)) return null;
  return text.slice(0, max);
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

function groundedEmail(value: unknown, userTexts: string[]): string | null {
  const email = cleanText(value, MAX_LENGTH.email)?.toLowerCase() ?? null;
  if (!email || !EMAIL_PATTERN.test(email)) return null;
  return userTexts.some((t) => t.toLowerCase().includes(email)) ? email : null;
}

function groundedPhone(value: unknown, userTexts: string[]): string | null {
  const raw = cleanText(value, MAX_LENGTH.phone);
  if (!raw) return null;
  const phone = raw.replace(/[^0-9+()\-. ]/g, "").trim();
  const digits = digitsOf(phone);
  if (digits.length < 8 || digits.length > 15) return null;
  // So 9 chữ số cuối để chấp nhận khác biệt đầu số (0xx / +84 xx).
  const core = digits.slice(-9);
  return userTexts.some((t) => digitsOf(t).includes(core)) ? phone : null;
}

/** `userTexts`: nội dung các tin nhắn do KHÁCH gửi (không gồm lời của chatbot). */
export function sanitizeLead(raw: unknown, userTexts: string[]): Lead {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const email = groundedEmail(r.email, userTexts);
  const phone = groundedPhone(r.phone, userTexts);

  let quality: LeadQuality =
    r.quality === "good" || r.quality === "spam" || r.quality === "ok" ? r.quality : "ok";
  let qualityReason = cleanText(r.qualityReason ?? r.quality_reason, MAX_LENGTH.qualityReason);

  // "good" nghĩa là liên hệ được với khách; không có email/sđt hợp lệ thì chỉ là "ok", bất kể model hay khách nói gì.
  if (quality === "good" && !email && !phone) {
    quality = "ok";
    qualityReason = `${qualityReason ? `${qualityReason} ` : ""}(Hạ xuống "ok" vì chưa có email hoặc số điện thoại hợp lệ của khách.)`.slice(
      0,
      MAX_LENGTH.qualityReason,
    );
  }

  const wants = r.wantsConsultation ?? r.wants_consultation;

  return {
    name: cleanText(r.name, MAX_LENGTH.name),
    email,
    phone,
    studyCountry: cleanText(r.studyCountry ?? r.study_country, MAX_LENGTH.studyCountry),
    educationLevel: cleanText(r.educationLevel ?? r.education_level, MAX_LENGTH.educationLevel),
    major: cleanText(r.major, MAX_LENGTH.major),
    availability: cleanText(r.availability, MAX_LENGTH.availability),
    wantsConsultation: typeof wants === "boolean" ? wants : null,
    note: cleanText(r.note, MAX_LENGTH.note),
    quality,
    qualityReason,
  };
}
