// Logic thuần cho đăng nhập bằng magic link (không import runtime nên test trực tiếp bằng Node).

export const DEFAULT_AFTER_LOGIN = "/portal";

/**
 * Đường dẫn chuyển hướng sau khi đăng nhập (`?next=`). Chỉ nhận đường dẫn nội bộ dạng "/abc"; mọi thứ khác
 * ("//evil.com", "https://evil.com", "/\\evil.com", rỗng, có ký tự điều khiển...) thành `fallback` để không bị lợi dụng làm open redirect.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    // Phải phân tích ra cùng một origin giả định thì mới là đường dẫn nội bộ.
    const url = new URL(raw, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}

/** Loại token trong link email mà callback chấp nhận (link magic link của Supabase). */
export type MagicLinkOtpType = "email" | "magiclink";

export function parseOtpType(raw: string | null | undefined): MagicLinkOtpType | null {
  return raw === "email" || raw === "magiclink" ? raw : null;
}

export type LoginErrorCode = "link_invalid" | "link_expired" | "not_configured";

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  link_invalid: "Link đăng nhập không hợp lệ hoặc đã được dùng. Vui lòng nhập email để nhận link mới.",
  link_expired: "Link đăng nhập đã hết hạn. Vui lòng nhập email để nhận link mới.",
  not_configured: "Hệ thống đăng nhập chưa được cấu hình. Vui lòng thử lại sau.",
};

/** Thông điệp cho mã lỗi ở `/login?error=...`. Mã lạ thì không hiện gì (không phản chiếu chuỗi người dùng nhập). */
export function loginErrorMessage(code: string | string[] | null | undefined): string | null {
  const value = Array.isArray(code) ? code[0] : code;
  return value && Object.hasOwn(LOGIN_ERROR_MESSAGES, value) ? LOGIN_ERROR_MESSAGES[value as LoginErrorCode] : null;
}

/** Callback nhận lỗi từ Supabase (`?error=access_denied&error_code=otp_expired`) thì đổi sang mã lỗi của trang đăng nhập. */
export function loginErrorFromSupabase(errorCode: string | null | undefined): LoginErrorCode {
  return errorCode === "otp_expired" ? "link_expired" : "link_invalid";
}
