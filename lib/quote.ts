// Bảng giá và kiểm tra dữ liệu của form báo giá. Hàm thuần, không import runtime nên test trực tiếp bằng Node.
// Giá chỉ tính ở đây theo gói: server KHÔNG bao giờ tin giá do trình duyệt gửi lên.

export type QuotePackage = "co_ban" | "toan_dien";
export type QuoteEducationLevel = "thpt" | "dai_hoc" | "thac_si";

/** Mức giá báo cho khách (VND) theo gói dịch vụ. */
export const QUOTE_PRICES: Record<QuotePackage, number> = {
  co_ban: 15_000_000,
  toan_dien: 30_000_000,
};

export const QUOTE_EDUCATION_LEVELS: readonly QuoteEducationLevel[] = ["thpt", "dai_hoc", "thac_si"];

export const QUOTE_NAME_MAX = 200;
export const QUOTE_EMAIL_MAX = 320;

export interface QuoteInput {
  customerName: string;
  email: string;
  studyCountry: string;
  educationLevel: QuoteEducationLevel;
  servicePackage: QuotePackage;
}

export type QuoteParseResult = { ok: true; value: QuoteInput } | { ok: false; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function priceFor(servicePackage: QuotePackage): number {
  return QUOTE_PRICES[servicePackage];
}

function isPackage(value: unknown): value is QuotePackage {
  return typeof value === "string" && Object.hasOwn(QUOTE_PRICES, value);
}

function isLevel(value: unknown): value is QuoteEducationLevel {
  return typeof value === "string" && (QUOTE_EDUCATION_LEVELS as readonly string[]).includes(value);
}

/** Kiểm tra dữ liệu thô từ trình duyệt. Chỉ nhận các trường cần thiết; mọi trường khác (kể cả `price`) bị bỏ qua. */
export function parseQuoteRequest(raw: unknown, allowedCountries: readonly string[]): QuoteParseResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, message: "Dữ liệu gửi lên không hợp lệ." };
  const body = raw as Record<string, unknown>;

  const customerName = typeof body.customerName === "string" ? body.customerName.replace(/\s+/g, " ").trim() : "";
  if (!customerName) return { ok: false, message: "Vui lòng nhập họ tên." };
  if (customerName.length > QUOTE_NAME_MAX || CONTROL_CHARS.test(customerName)) {
    return { ok: false, message: "Họ tên không hợp lệ." };
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) return { ok: false, message: "Vui lòng nhập email." };
  if (email.length > QUOTE_EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
    return { ok: false, message: "Email không hợp lệ, vui lòng kiểm tra lại." };
  }

  const studyCountry = typeof body.studyCountry === "string" ? body.studyCountry : "";
  if (!studyCountry) return { ok: false, message: "Vui lòng chọn quốc gia muốn du học." };
  if (!allowedCountries.includes(studyCountry)) return { ok: false, message: "Quốc gia đã chọn không hợp lệ." };

  if (!isLevel(body.educationLevel)) return { ok: false, message: "Vui lòng chọn bậc học." };
  if (!isPackage(body.servicePackage)) return { ok: false, message: "Vui lòng chọn gói dịch vụ." };

  return {
    ok: true,
    value: { customerName, email, studyCountry, educationLevel: body.educationLevel, servicePackage: body.servicePackage },
  };
}
