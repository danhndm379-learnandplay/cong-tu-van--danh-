import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { authEnv, sessionCookieOptions } from "@/lib/auth-env";

// Đăng nhập người dùng bằng Supabase Auth (magic link). Phiên lưu trong cookie httpOnly do @supabase/ssr quản lý;
// proxy.ts làm mới token trước khi trang render. Chỉ chạy ở server.

export class AuthNotConfiguredError extends Error {
  constructor() {
    super("Thiếu SUPABASE_URL hoặc SUPABASE_PUBLISHABLE_KEY nên không dùng được đăng nhập.");
    this.name = "AuthNotConfiguredError";
  }
}

/** Client Supabase gắn với cookie của request hiện tại. Dùng trong Server Component, Server Action và Route Handler. */
export async function createAuthClient() {
  const env = authEnv();
  if (!env) throw new AuthNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, sessionCookieOptions(options)));
        } catch {
          // Server Component không ghi được cookie: proxy.ts đã làm mới phiên rồi.
        }
      },
    },
  });
}

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** Người dùng đang đăng nhập (đã được máy chủ Supabase xác thực token), hoặc null nếu chưa đăng nhập. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!authEnv()) return null;
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  } catch (err) {
    unstable_rethrow(err); // tín hiệu nội bộ của Next (render động, redirect...) phải đi tiếp, không được nuốt
    console.error("[auth] Không đọc được phiên đăng nhập:", err);
    return null;
  }
}
