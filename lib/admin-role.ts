// Phân quyền khu quản trị (logic thuần, không import runtime nên test trực tiếp bằng Node).
//
// Học viên và đội ngũ cùng là người dùng của Supabase Auth, và endpoint đăng ký của Supabase vẫn mở (học viên cần nó để đăng nhập
// bằng magic link), nên "đăng nhập được" KHÔNG có nghĩa là được vào khu quản trị. Vai trò nằm ở `app_metadata.role`:
//   "admin"     : xem, sửa, xoá dữ liệu hồ sơ học viên, xoá hội thoại, xử lý yêu cầu báo giá, trích xuất lead.
//   "nhan_vien" : chỉ XEM (không có nút sửa/xoá, và database từ chối mọi thao tác ghi: xem migration role_based_rls_admin_staff).
// `app_metadata` chỉ server (secret key) hoặc Supabase Dashboard mới sửa được; `user_metadata` thì chính người dùng tự sửa được
// (auth.updateUser({ data })), nên TUYỆT ĐỐI không dùng `user_metadata` để phân quyền.

export const ADMIN_ROLE = "admin";
export const STAFF_ROLE = "nhan_vien";
export const ROLE_LABELS = { admin: "Admin", nhan_vien: "Nhân viên" } as const;
export type StaffRole = keyof typeof ROLE_LABELS;

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_HOME_PATH = "/admin/requests";

/** Vai trò quản trị của tài khoản ("admin" | "nhan_vien"), hoặc null nếu không có/không hợp lệ (vd. học viên). */
export function staffRole(appMetadata: unknown): StaffRole | null {
  if (typeof appMetadata !== "object" || appMetadata === null) return null;
  const role = (appMetadata as Record<string, unknown>).role;
  return role === ADMIN_ROLE || role === STAFF_ROLE ? role : null;
}

/** Được vào khu quản trị (admin hoặc nhân viên). */
export function isStaffRole(appMetadata: unknown): boolean {
  return staffRole(appMetadata) !== null;
}

/** Được sửa/xoá dữ liệu: chỉ admin. Nhân viên chỉ xem. */
export function canModifyData(role: StaffRole | null | undefined): boolean {
  return role === ADMIN_ROLE;
}

export function isAdminRole(appMetadata: unknown): boolean {
  if (typeof appMetadata !== "object" || appMetadata === null) return false;
  return (appMetadata as Record<string, unknown>).role === ADMIN_ROLE;
}

/**
 * Trang đến sau khi đăng nhập admin (`?next=`): chỉ nhận đường dẫn nội bộ nằm trong /admin và không phải chính trang đăng nhập.
 * Mọi giá trị khác (open redirect, rỗng, lạ) về trang chủ admin.
 */
export function safeAdminNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return ADMIN_HOME_PATH;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f\u007f]/.test(raw)) return ADMIN_HOME_PATH;
  let url: URL;
  try {
    url = new URL(raw, "http://internal.invalid");
  } catch {
    return ADMIN_HOME_PATH;
  }
  if (url.origin !== "http://internal.invalid") return ADMIN_HOME_PATH;
  const inAdmin = url.pathname === "/admin" || url.pathname.startsWith("/admin/");
  const isLogin = url.pathname === ADMIN_LOGIN_PATH || url.pathname.startsWith(`${ADMIN_LOGIN_PATH}/`);
  return inAdmin && !isLogin ? url.pathname + url.search : ADMIN_HOME_PATH;
}

/** Đường dẫn trang đăng nhập admin kèm `?next=` để quay lại đúng trang đang xem (chỉ khi không phải trang chủ admin mặc định). */
export function adminLoginUrl(returnTo?: string): string {
  const next = returnTo ? safeAdminNextPath(returnTo) : ADMIN_HOME_PATH;
  return next === ADMIN_HOME_PATH ? ADMIN_LOGIN_PATH : `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}
