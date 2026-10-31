// Cấu hình Supabase Auth: dùng URL + publishable key (quyền tối thiểu, đúng loại key cho đăng nhập người dùng).
// Không dùng secret key ở đây: secret key bỏ qua RLS và không bao giờ được dùng để tạo phiên của người dùng.
// File này không import `server-only` để proxy.ts dùng chung được.

export interface AuthEnv {
  url: string;
  key: string;
}

export function authEnv(): AuthEnv | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

/** Cookie phiên của @supabase/ssr có dạng `sb-<project>-auth-token` (có thể chia thành `.0`, `.1`...). */
export function hasAuthSessionCookie(names: string[]): boolean {
  return names.some((name) => name.startsWith("sb-") && name.includes("-auth-token"));
}

/**
 * Tuỳ chọn cho cookie phiên. @supabase/ssr mặc định để cookie đọc được bằng JavaScript (cho client trình duyệt dùng), nhưng site này
 * chỉ dùng phiên ở server nên đặt httpOnly: mã chạy trên trang (XSS) không đọc/lấy cắp được phiên. `secure` khi chạy bản production.
 */
export function sessionCookieOptions<T extends object>(options: T | undefined): T & { httpOnly: true; secure: boolean } {
  return { ...(options as T), httpOnly: true, secure: process.env.NODE_ENV === "production" };
}
