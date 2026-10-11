import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdminAuthEnabled, isAdminAuthorized } from "@/lib/admin-auth";

// Đăng nhập tuỳ chọn cho trang xem hội thoại thật của khách: chỉ bật khi đã đặt ADMIN_PASSWORD.
// Chưa đặt thì để mở (các trang admin dùng mock data cũng đang mở như vậy).
export function proxy(request: NextRequest) {
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
  matcher: ["/admin/conversations", "/admin/conversations/:path*"],
};
