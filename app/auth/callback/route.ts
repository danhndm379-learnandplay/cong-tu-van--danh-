import { NextResponse, type NextRequest } from "next/server";
import { authEnv } from "@/lib/auth-env";
import { loginErrorFromSupabase, parseOtpType, safeNextPath } from "@/lib/auth-redirect";
import { createAuthClient } from "@/lib/supabase-auth";

// Đích của link trong email đăng nhập VÀ của đăng nhập bằng Google (OAuth, luôn trả về `?code=`). Hỗ trợ các dạng:
//  - `?code=...`: luồng PKCE mặc định, dùng cho Google và link email (phải ở CÙNG trình duyệt đã bắt đầu đăng nhập, vì cookie code-verifier nằm ở đó);
//  - `?token_hash=...&type=email`: khi đã sửa mẫu email theo docs/ghi-chu-dang-nhap.md (mở được ở thiết bị/trình duyệt khác).
// Thành công thì phiên đăng nhập được ghi vào cookie rồi chuyển tới `next` (mặc định /portal); lỗi thì về /login?error=...
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!authEnv()) return to("/login?error=not_configured");

  // Supabase báo lỗi qua query (link hết hạn, đã dùng...).
  if (searchParams.get("error")) return to(`/login?error=${loginErrorFromSupabase(searchParams.get("error_code"), searchParams.get("error"))}`);

  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = parseOtpType(searchParams.get("type"));

  try {
    const supabase = await createAuthClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return to(next);
      console.error(`[auth/callback] Đổi code thất bại (${error.status ?? "?"} ${error.code ?? error.name}).`);
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return to(next);
      console.error(`[auth/callback] Xác thực token thất bại (${error.status ?? "?"} ${error.code ?? error.name}).`);
    }
  } catch (err) {
    console.error("[auth/callback] Lỗi không mong đợi:", err);
  }
  return to("/login?error=link_invalid");
}
