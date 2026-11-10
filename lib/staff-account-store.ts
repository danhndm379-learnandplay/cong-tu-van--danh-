import "server-only";

import type { AccountRole } from "@/lib/account-admin";
import { staffRole } from "@/lib/admin-role";
import { adminDb, StorageError } from "@/lib/chat-store";

// Tài khoản nội bộ = người dùng Supabase Auth có `app_metadata.role` là admin hoặc nhan_vien. Dùng Auth Admin API với secret key (chỉ chạy ở server);
// RLS không áp dụng cho API này nên NƠI GỌI BẮT BUỘC kiểm tra người gọi là admin (`checkAdminWrite()` / `requireAdmin()`).
// Vai trò chỉ ghi vào `app_metadata` (người dùng không tự sửa được), TUYỆT ĐỐI không ghi vào `user_metadata`.

export interface StaffAccount {
  id: string;
  email: string | null;
  role: AccountRole;
  createdAt: string;
  lastSignInAt: string | null;
}

const PER_PAGE = 200;
const MAX_PAGES = 25; // tối đa 5.000 người dùng; nhiều hơn thì cần lọc ở phía database thay vì quét hết

/** Duyệt hết các trang người dùng (học viên và đội ngũ cùng nằm trong bảng này nên phải lọc theo vai trò). */
async function listAllUsers() {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await adminDb().auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw new StorageError("list auth users", error);
    users.push(...data.users);
    if (data.users.length < PER_PAGE) break;
  }
  return users;
}

/** Mọi tài khoản nội bộ: admin trước, rồi theo email. */
export async function listStaffAccounts(): Promise<StaffAccount[]> {
  const accounts: StaffAccount[] = [];
  for (const user of await listAllUsers()) {
    const role = staffRole(user.app_metadata);
    if (!role) continue;
    accounts.push({ id: user.id, email: user.email ?? null, role, createdAt: user.created_at, lastSignInAt: user.last_sign_in_at ?? null });
  }
  return accounts.sort((a, b) => (a.role === b.role ? (a.email ?? "").localeCompare(b.email ?? "") : a.role === "admin" ? -1 : 1));
}

export type CreateStaffResult = { ok: true; id: string } | { ok: false; reason: "email_exists" | "weak_password" | "failed" };

/** Tạo tài khoản đăng nhập bằng email + mật khẩu (đã xác nhận sẵn, không gửi email) với vai trò cho trước. Không ghi mật khẩu vào log. */
export async function createStaffAccount(email: string, password: string, role: AccountRole): Promise<CreateStaffResult> {
  const { data, error } = await adminDb().auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (error) {
    console.error(`[staff-accounts] Tạo tài khoản thất bại (${error.status ?? "?"} ${error.code ?? error.name}).`);
    if (error.code === "email_exists" || error.code === "user_already_exists") return { ok: false, reason: "email_exists" };
    if (error.code === "weak_password") return { ok: false, reason: "weak_password" };
    return { ok: false, reason: "failed" };
  }
  return { ok: true, id: data.user.id };
}

/** Một tài khoản nội bộ theo id; null nếu không tồn tại hoặc không phải tài khoản nội bộ. */
export async function getStaffAccount(id: string): Promise<StaffAccount | null> {
  const { data, error } = await adminDb().auth.admin.getUserById(id);
  if (error || !data.user) return null;
  const role = staffRole(data.user.app_metadata);
  if (!role) return null;
  return { id: data.user.id, email: data.user.email ?? null, role, createdAt: data.user.created_at, lastSignInAt: data.user.last_sign_in_at ?? null };
}

/**
 * Đổi vai trò của MỘT tài khoản nội bộ (giữ nguyên các khoá khác của app_metadata). false nếu tài khoản không tồn tại hoặc không phải nội bộ.
 * Có hiệu lực NGAY ở mọi lớp: chốt chặn trang/Server Action (getUser() đọc từ database) và RLS (private.staff_role() tra auth.users,
 * không tin vai trò trong token; migration role_rls_read_role_from_database). Người bị hạ quyền không cần đăng nhập lại.
 */
export async function setStaffAccountRole(id: string, role: AccountRole): Promise<boolean> {
  const { data, error } = await adminDb().auth.admin.getUserById(id);
  if (error || !data.user || !staffRole(data.user.app_metadata)) return false;
  const { error: updateError } = await adminDb().auth.admin.updateUserById(id, { app_metadata: { ...data.user.app_metadata, role } });
  if (updateError) throw new StorageError("update staff role", updateError);
  return true;
}
