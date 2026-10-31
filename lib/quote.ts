// Bảng giá và kiểm tra dữ liệu của form báo giá. Hàm thuần, không import runtime nên test trực tiếp bằng Node.
// Giá chỉ tính ở đây theo gói: server KHÔNG bao giờ tin giá do trình duyệt gửi lên.

export type QuotePackage = "co_ban" | "toan_dien";
export type QuoteEducationLevel = "thpt" | "dai_hoc" | "thac_si";

/** Mức giá báo cho khách (VND) theo gói dịch vụ. */
export const QUOTE_PRICES: Record<QuotePackage, number> = {
  co_ban: 15_000_000,
  toan_dien: 30_000_000,
};

export const QUOTE_PACKAGE_NAMES: Record<QuotePackage, string> = {
  co_ban: "Cơ bản",
  toan_dien: "Toàn diện",
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

// Phần trước @: các nhóm ký tự thường gặp, ngăn cách bằng MỘT dấu chấm (không đầu/cuối/liền nhau).
// Phần sau @: các nhãn tên miền (chữ, số, gạch nối ở giữa) ngăn cách bằng dấu chấm, đuôi tối thiểu 2 chữ cái.
const EMAIL_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;
const EMAIL_LOCAL_MAX = 64;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export const EMAIL_INVALID_MESSAGE = "Email không đúng định dạng, vui lòng nhập lại (ví dụ: ten@gmail.com).";

/** Kiểm tra định dạng email (đã bỏ khoảng trắng hai đầu). Dùng chung cho form ở trình duyệt và server. */
export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (email.length > QUOTE_EMAIL_MAX || email.indexOf("@") > EMAIL_LOCAL_MAX) return false;
  return EMAIL_PATTERN.test(email);
}

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
  if (!isValidEmail(email)) return { ok: false, message: EMAIL_INVALID_MESSAGE };

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

// ---- Webhook (Make.com): báo cho hệ thống ngoài khi có yêu cầu báo giá mới ----

export interface QuoteWebhookPayload {
  event: "quote_request.created";
  id: string;
  customerName: string;
  email: string;
  servicePackage: QuotePackage;
  servicePackageName: string;
  price: number;
  createdAt: string;
}

/** Chỉ gồm các thông tin cần gửi đi: tên, email, gói, giá (kèm id và giờ tạo để bên nhận chống trùng). */
export function buildQuoteWebhookPayload(input: QuoteInput, saved: { id: string; price: number; createdAt: string }): QuoteWebhookPayload {
  return {
    event: "quote_request.created",
    id: saved.id,
    customerName: input.customerName,
    email: input.email,
    servicePackage: input.servicePackage,
    servicePackageName: QUOTE_PACKAGE_NAMES[input.servicePackage],
    price: saved.price,
    createdAt: saved.createdAt,
  };
}

/** Chỉ nhận URL https (hoặc http tới localhost để thử). Trả về null nếu thiếu/sai để bỏ qua việc gửi. */
export function parseWebhookUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface QuoteApprovedWebhookPayload {
  event: "quote_request.approved";
  id: string;
  customerName: string;
  email: string;
  loginUrl: string;
}

/** Thông tin gửi sang Make khi admin duyệt: tên, email và link đăng nhập (kèm id để bên nhận chống trùng). */
export function buildApprovedWebhookPayload(
  request: { id: string; customerName: string; email: string },
  loginUrl: string,
): QuoteApprovedWebhookPayload {
  return { event: "quote_request.approved", id: request.id, customerName: request.customerName, email: request.email, loginUrl };
}

/** Chỉ nhận URL http(s) không kèm tên/mật khẩu. Trả về null nếu thiếu/sai. */
export function parseLoginUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Link đăng nhập gửi cho khách. Ưu tiên giá trị đã cấu hình (`QUOTE_LOGIN_URL`: tuần sau chỉ cần đổi giá trị này thành link thật),
 * không có thì dùng trang /login trên địa chỉ website (`siteUrl`).
 */
export function resolveLoginUrl(configured: string | undefined, siteUrl: string): string {
  return parseLoginUrl(configured) ?? new URL("/login", siteUrl).toString();
}

export type WebhookResult = { ok: true } | { ok: false; reason: string };

/** POST JSON tới webhook, có giới hạn thời gian. Không bao giờ ném lỗi; kết quả không chứa URL hay dữ liệu khách. */
export async function postQuoteWebhook(url: string, payload: QuoteWebhookPayload | QuoteApprovedWebhookPayload, timeoutMs = 8000): Promise<WebhookResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? { ok: true } : { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : "unknown" };
  }
}
