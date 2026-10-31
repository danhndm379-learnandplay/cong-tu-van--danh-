import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdminAuthEnabled, isAdminAuthorized } from "@/lib/admin-auth";
import { authEnv, hasAuthSessionCookie, sessionCookieOptions } from "@/lib/auth-env";

// Hai việc, chia theo đường dẫn:
// 1) Trang admin có dữ liệu khách (hội thoại, yêu cầu báo giá): đăng nhập TUỲ CHỌN (HTTP Basic), chỉ bật khi đã đặt ADMIN_PASSWORD.
//    Chưa đặt thì để mở (các trang admin dùng mock data cũng đang mở như vậy).
// 2) Trang dùng phiên đăng nhập của người dùng:
//    - /portal (cổng hồ sơ) BẮT BUỘC đăng nhập: chưa đăng nhập thì chuyển sang /login ngay tại đây;
//    - /login: chỉ làm mới token Supabase trước khi trang render (Server Component không ghi được cookie).
//    Chỉ gọi Supabase khi trình duyệt đang có cookie phiên. Trang và API vẫn tự kiểm tra lại (đây chỉ là lớp chặn sớm).
function isAdminPath(pathname: string) {
  return pathname.startsWith("/admin/");
}

function requiresLogin(pathname: string) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

function redirectToLogin(request: NextRequest, from?: NextResponse) {
  const redirect = NextResponse.redirect(new URL("/login", request.url));
  // Giữ lại cookie mà Supabase vừa xoá/làm mới (vd. phiên hết hạn) để trình duyệt dọn đúng.
  from?.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

async function handleUserPages(request: NextRequest) {
  const mustLogin = requiresLogin(request.nextUrl.pathname);
  const env = authEnv();
  if (!env || !hasAuthSessionCookie(request.cookies.getAll().map((c) => c.name))) {
    return mustLogin ? redirectToLogin(request) : NextResponse.next();
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
  if (mustLogin && !data.user) return redirectToLogin(request, response);
  return response;
}

export async function proxy(request: NextRequest) {
  if (!isAdminPath(request.nextUrl.pathname)) return handleUserPages(request);

  if (!isAdminAuthEnabled()) return NextResponse.next();

  if (isAdminAuthorized(request.headers.get("authorization"))) return NextResponse.next();

  return new NextResponse("Cần đăng nhập quản trị để xem nội dung này.", {
    status: 401,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "WWW-Authenticate": `Basic realm="${ADMIN_REALM}", charset="UTF-8"`,
    },
  });
}

export const config = {
  matcher: ["/admin/conversations", "/admin/conversations/:path*", "/admin/requests", "/portal", "/portal/:path*", "/login"],
};
