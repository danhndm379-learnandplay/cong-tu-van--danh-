import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN_PATH, adminLoginUrl, isStaffRole } from "@/lib/admin-role";
import { authEnv, hasAuthSessionCookie, sessionCookieOptions } from "@/lib/auth-env";

// Chặn sớm theo đường dẫn, dùng phiên đăng nhập Supabase (cookie) và làm mới token trước khi trang render
// (Server Component không ghi được cookie). Chỉ gọi Supabase khi trình duyệt đang có cookie phiên.
//   - /admin/* (trừ /admin/login): chỉ tài khoản có app_metadata.role = "admin" hoặc "nhan_vien"; không thì chuyển sang /admin/login?next=...
//     (việc nhân viên chỉ được xem, không được sửa/xoá do trang, Server Action và RLS ở database quyết định)
//   - /portal/*: phải đăng nhập (học viên, magic link); không thì chuyển sang /login
//   - /login, /admin/login: chỉ làm mới token
// Đây chỉ là lớp chặn sớm: trang, Server Action và route vẫn tự kiểm tra lại (lib/admin-guard.ts, lib/supabase-auth.ts).
function isAdminArea(pathname: string) {
  return (pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== ADMIN_LOGIN_PATH && !pathname.startsWith(`${ADMIN_LOGIN_PATH}/`);
}

function isPortal(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const adminArea = isAdminArea(pathname);
  const mustLogin = adminArea || isPortal(pathname);
  const loginTarget = adminArea ? adminLoginUrl(pathname + search) : "/login";

  const redirectToLogin = (from?: NextResponse) => {
    const redirect = NextResponse.redirect(new URL(loginTarget, request.url));
    // Giữ lại cookie mà Supabase vừa xoá/làm mới (vd. phiên hết hạn) để trình duyệt dọn đúng.
    from?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  const env = authEnv();
  if (!env || !hasAuthSessionCookie(request.cookies.getAll().map((c) => c.name))) {
    return mustLogin ? redirectToLogin() : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options)));
      },
    },
  });
  // getUser() nhờ máy chủ Supabase xác thực token (và làm mới nếu cần; cookie mới được ghi qua setAll ở trên).
  const { data } = await supabase.auth.getUser();
  if (mustLogin && !data.user) return redirectToLogin(response);
  if (adminArea && !isStaffRole(data.user?.app_metadata)) return redirectToLogin(response);
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/portal", "/portal/:path*", "/login"],
};
