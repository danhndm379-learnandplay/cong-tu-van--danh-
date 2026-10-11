import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminAuthEnabled, isAdminAuthorized } from "@/lib/admin-auth";

/**
 * Gọi ở đầu mọi trang/route đọc dữ liệu riêng tư của khách.
 * Chỉ có tác dụng khi đã đặt ADMIN_PASSWORD (xem lib/admin-auth.ts); khi đó không hợp lệ thì trả 404.
 */
export async function requireAdmin() {
  if (!isAdminAuthEnabled()) return;
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();
}
