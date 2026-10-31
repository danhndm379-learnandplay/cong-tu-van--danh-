"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authEnv } from "@/lib/auth-env";
import { clientIp } from "@/lib/client-ip";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/site-url";
import { createAuthClient } from "@/lib/supabase-auth";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

// Mỗi lần gửi tốn một email trong hạn mức của Gmail/Supabase, nên giới hạn để không bị lợi dụng gửi thư rác tới người khác:
// theo IP, theo từng email (Supabase cũng chặn gửi lại trong 60 giây) và toàn site (Supabase mặc định 30 email/giờ khi dùng SMTP riêng).
const LIMIT_PER_IP = 5;
const LIMIT_PER_EMAIL_WINDOW_MS = 60_000;
const LIMIT_GLOBAL_PER_HOUR = 25;

/** Gửi magic link tới email người dùng nhập. Luôn trả lời giống nhau dù email đã có tài khoản hay chưa. */
export async function sendMagicLinkAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const fail = (message: string): LoginState => ({ status: "error", message, email });

  if (!email) return fail("Vui lòng nhập email.");
  if (!isValidEmail(email)) return fail(EMAIL_INVALID_MESSAGE);

  if (!authEnv()) {
    console.error("[login] Thiếu SUPABASE_URL hoặc SUPABASE_PUBLISHABLE_KEY.");
    return fail("Hệ thống đăng nhập chưa được cấu hình. Vui lòng thử lại sau.");
  }

  const ip = clientIp(new Request("http://x", { headers: await headers() }));
  const perIp = checkRateLimit(`login-ip:${ip}`, LIMIT_PER_IP);
  const perEmail = perIp.ok ? checkRateLimit(`login-email:${email.toLowerCase()}`, 1, LIMIT_PER_EMAIL_WINDOW_MS) : perIp;
  const global = perEmail.ok ? checkRateLimit("login-global", LIMIT_GLOBAL_PER_HOUR, 3_600_000) : perEmail;
  if (!global.ok) return fail(`Bạn thao tác hơi nhanh, vui lòng đợi ${global.retryAfterSec} giây rồi thử lại.`);

  try {
    const supabase = await createAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${await requestOrigin()}/auth/callback` },
    });
    if (error) {
      // Không ghi email vào log.
      console.error(`[login] Gửi magic link thất bại (${error.status ?? "?"} ${error.code ?? error.name}).`);
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        return fail("Hệ thống đã gửi quá nhiều email, vui lòng thử lại sau ít phút.");
      }
      return fail("Chưa gửi được email đăng nhập. Vui lòng thử lại sau ít phút.");
    }
  } catch (err) {
    console.error("[login] Lỗi không mong đợi khi gửi magic link:", err);
    return fail("Chưa gửi được email đăng nhập. Vui lòng thử lại sau ít phút.");
  }

  return { status: "sent", email };
}

/** Đăng xuất (chỉ thiết bị này) rồi về trang đăng nhập. */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createAuthClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("[login] Đăng xuất thất bại:", err);
  }
  redirect("/login");
}
