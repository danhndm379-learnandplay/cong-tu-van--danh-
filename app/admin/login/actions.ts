"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_LOGIN_PATH, isStaffRole, safeAdminNextPath } from "@/lib/admin-role";
import { authEnv } from "@/lib/auth-env";
import { clientIp } from "@/lib/client-ip";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuthClient } from "@/lib/supabase-auth";

export type AdminLoginState = { status: "idle" } | { status: "error"; message: string; email: string };

// Chống dò mật khẩu: theo IP và theo từng email (tính cả lần đúng lẫn sai). Bộ giới hạn nằm trong bộ nhớ nên trên serverless chỉ gần đúng;
// Supabase cũng tự giới hạn tần suất đăng nhập ở phía họ.
const LIMIT_PER_IP = 8;
const LIMIT_PER_EMAIL = 10;
const LIMIT_PER_EMAIL_WINDOW_MS = 10 * 60_000;
const MAX_PASSWORD_LENGTH = 200;

// MỘT thông điệp chung cho mọi lý do thất bại (sai mật khẩu, không có tài khoản, có tài khoản nhưng không phải admin) để
// không lộ email nào là tài khoản quản trị.
const INVALID_CREDENTIALS = "Email hoặc mật khẩu không đúng.";

/** Đăng nhập quản trị (admin hoặc nhân viên) bằng email + mật khẩu. Không có trang đăng ký: tài khoản do đội tự tạo sẵn (scripts/create-admin.mjs). */
export async function adminSignInAction(_previous: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeAdminNextPath(String(formData.get("next") ?? ""));
  const fail = (message: string): AdminLoginState => ({ status: "error", message, email });

  if (!email) return fail("Vui lòng nhập email.");
  if (!isValidEmail(email)) return fail(EMAIL_INVALID_MESSAGE);
  if (!password) return fail("Vui lòng nhập mật khẩu.");
  if (password.length > MAX_PASSWORD_LENGTH) return fail(INVALID_CREDENTIALS);

  if (!authEnv()) {
    console.error("[admin-login] Thiếu SUPABASE_URL hoặc SUPABASE_PUBLISHABLE_KEY.");
    return fail("Hệ thống đăng nhập chưa được cấu hình. Vui lòng liên hệ quản trị viên.");
  }

  const ip = clientIp(new Request("http://x", { headers: await headers() }));
  const perIp = checkRateLimit(`admin-login-ip:${ip}`, LIMIT_PER_IP);
  const limited = perIp.ok ? checkRateLimit(`admin-login-email:${email.toLowerCase()}`, LIMIT_PER_EMAIL, LIMIT_PER_EMAIL_WINDOW_MS) : perIp;
  if (!limited.ok) return fail(`Bạn thử đăng nhập quá nhiều lần, vui lòng đợi ${limited.retryAfterSec} giây rồi thử lại.`);

  let allowed = false;
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      // Không ghi email vào log.
      console.error(`[admin-login] Đăng nhập thất bại (${error?.status ?? "?"} ${error?.code ?? error?.name ?? "no_user"}).`);
    } else if (!isStaffRole(data.user.app_metadata)) {
      // Đăng nhập được nhưng không phải admin/nhân viên (vd. học viên): huỷ phiên vừa tạo và báo giống hệt trường hợp sai mật khẩu.
      await supabase.auth.signOut({ scope: "local" });
      console.error("[admin-login] Tài khoản đăng nhập được nhưng không có vai trò quản trị, đã từ chối.");
    } else {
      allowed = true;
    }
  } catch (err) {
    console.error("[admin-login] Lỗi không mong đợi:", err);
    return fail("Chưa đăng nhập được do lỗi hệ thống. Vui lòng thử lại sau ít phút.");
  }

  if (!allowed) return fail(INVALID_CREDENTIALS);
  redirect(next);
}

/** Đăng xuất admin (chỉ thiết bị này) rồi về trang đăng nhập admin. */
export async function adminSignOutAction(): Promise<void> {
  try {
    const supabase = await createAuthClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("[admin-login] Đăng xuất thất bại:", err);
  }
  redirect(ADMIN_LOGIN_PATH);
}
