import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminAuthEnabled, isAdminAuthorized } from "@/lib/admin-auth";

/**
 * Gọi ở đầu mọi trang/route ĐỌC dữ liệu riêng tư của khách.
 * Chỉ có tác dụng khi đã đặt ADMIN_PASSWORD (xem lib/admin-auth.ts); khi đó không hợp lệ thì trả 404.
 */
export async function requireAdmin() {
  if (!isAdminAuthEnabled()) return;
  if (!isAdminAuthorized((await headers()).get("authorization"))) notFound();
}

export type WriteCheck = { ok: true } | { ok: false; error: string };

/**
 * Gọi trong Server Action / route GHI hoặc XOÁ dữ liệu. Server Action là endpoint công khai nên bắt buộc tự kiểm tra
 * quyền ở đây, không dựa vào việc nút bị ẩn. Cùng quy tắc với `requireAdmin()`: chỉ đòi đăng nhập khi đã đặt ADMIN_PASSWORD.
 * LƯU Ý: chưa đặt ADMIN_PASSWORD nghĩa là ai biết URL cũng xoá được hội thoại của khách.
 */
export async function checkAdminWrite(): Promise<WriteCheck> {
  if (!isAdminAuthEnabled()) return { ok: true };
  if (!isAdminAuthorized((await headers()).get("authorization"))) {
    return { ok: false, error: "Bạn chưa đăng nhập quản trị." };
  }
  return { ok: true };
}
