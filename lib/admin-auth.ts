import { createHash, timingSafeEqual } from "node:crypto";

// Đăng nhập TUỲ CHỌN cho khu vực xem hội thoại thật của khách (HTTP Basic Auth, tạm cho tới khi có Supabase Auth ở Tuần 6).
// - Không đặt ADMIN_PASSWORD: KHÔNG yêu cầu đăng nhập, ai biết URL cũng xem được hội thoại của khách.
// - Có đặt ADMIN_PASSWORD: bắt buộc đăng nhập (user mặc định `admin`, đổi bằng ADMIN_USER).
// Khi bật, kiểm tra ở 2 lớp: `proxy.ts` (hiện hộp thoại đăng nhập) và `requireAdmin()` ở lib/admin-guard.ts trong từng trang.

export const ADMIN_REALM = "DuHoc24 Admin";

function adminCredentials() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return { user: process.env.ADMIN_USER || "admin", password };
}

/** true nếu đã đặt ADMIN_PASSWORD, tức khu vực admin đang yêu cầu đăng nhập. */
export function isAdminAuthEnabled() {
  return adminCredentials() !== null;
}

// So sánh qua sha256 để độ dài bằng nhau và dùng timingSafeEqual, tránh lộ thông tin qua thời gian phản hồi.
function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAdminAuthorized(authorization: string | null) {
  const expected = adminCredentials();
  if (!expected || !authorization?.startsWith("Basic ")) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(authorization.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;

  const userOk = safeEqual(decoded.slice(0, separator), expected.user);
  const passwordOk = safeEqual(decoded.slice(separator + 1), expected.password);
  return userOk && passwordOk;
}
