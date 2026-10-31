import "server-only";

import { redirect, unstable_rethrow } from "next/navigation";
import { ADMIN_LOGIN_PATH, canModifyData, staffRole, type StaffRole } from "@/lib/admin-role";
import { authEnv } from "@/lib/auth-env";
import { createAuthClient } from "@/lib/supabase-auth";

// Bảo vệ khu quản trị theo vai trò ở `app_metadata.role` (xem lib/admin-role.ts):
//   - requireStaff() / checkStaffRead(): admin HOẶC nhân viên (xem dữ liệu);
//   - checkAdminWrite(): CHỈ admin (sửa, xoá, trích xuất, duyệt...).
// Kiểm tra ở nhiều lớp: `proxy.ts` (chặn sớm), từng trang, từng Server Action và route (không dựa vào việc nút bị ẩn), và cuối cùng là
// RLS ở database: các thao tác sửa/xoá chạy bằng phiên của chính người dùng nên Postgres từ chối nếu không phải admin.

export interface StaffUser {
  id: string;
  email: string | null;
  role: StaffRole;
}

/** Tài khoản quản trị đang đăng nhập (phiên được máy chủ Supabase xác thực và có vai trò admin/nhan_vien), hoặc null. */
export async function getStaffUser(): Promise<StaffUser | null> {
  if (!authEnv()) return null;
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const role = staffRole(data.user.app_metadata);
    return role ? { id: data.user.id, email: data.user.email ?? null, role } : null;
  } catch (err) {
    unstable_rethrow(err); // tín hiệu nội bộ của Next (render động, redirect...) phải đi tiếp, không được nuốt
    console.error("[admin-guard] Không kiểm tra được phiên quản trị:", err);
    return null;
  }
}

/** Gọi ở đầu mọi trang quản trị: không phải admin/nhân viên thì chuyển sang trang đăng nhập. Trả về tài khoản và quyền sửa/xoá. */
export async function requireStaff(): Promise<StaffUser & { canWrite: boolean }> {
  const user = await getStaffUser();
  if (!user) redirect(ADMIN_LOGIN_PATH);
  return { ...user, canWrite: canModifyData(user.role) };
}

export type StaffCheck = { ok: true; user: StaffUser } | { ok: false; error: string };

/** Server Action / route CHỈ ĐỌC hoặc xuất dữ liệu: admin và nhân viên đều được. */
export async function checkStaffRead(): Promise<StaffCheck> {
  const user = await getStaffUser();
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập quản trị." };
  return { ok: true, user };
}

/** Server Action / route SỬA, XOÁ, GHI: chỉ admin. Nhân viên bị từ chối ở đây (và nếu lọt qua thì database cũng từ chối). */
export async function checkAdminWrite(): Promise<StaffCheck> {
  const user = await getStaffUser();
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập quản trị." };
  if (!canModifyData(user.role)) return { ok: false, error: "Tài khoản nhân viên chỉ được xem, không có quyền sửa hoặc xoá dữ liệu." };
  return { ok: true, user };
}
