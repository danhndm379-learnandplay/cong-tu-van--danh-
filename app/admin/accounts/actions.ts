"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { MIN_PASSWORD_LENGTH, parseAccountRole, passwordProblem, roleChangeProblem, type AccountRole } from "@/lib/account-admin";
import { checkAdminWrite } from "@/lib/admin-guard";
import { clientIp } from "@/lib/client-ip";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";
import { checkRateLimit } from "@/lib/rate-limit";
import { createStaffAccount, getStaffAccount, listStaffAccounts, setStaffAccountRole } from "@/lib/staff-account-store";

export type CreateAccountState =
  | { status: "idle" }
  | { status: "created"; email: string; role: AccountRole }
  | { status: "error"; message: string; email: string; role: string };
export type ChangeRoleResult = { ok: true; role: AccountRole } | { ok: false; error: string };

const CREATE_LIMIT_PER_IP = 10;
const ROLE_LIMIT_PER_IP = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ipOfCaller(): Promise<string> {
  return clientIp(new Request("http://x", { headers: await headers() }));
}

/**
 * Admin thêm tài khoản nội bộ (email + mật khẩu + vai trò). Server Action là endpoint công khai nên tự kiểm tra quyền: CHỈ admin.
 * Tài khoản được tạo sẵn ở trạng thái đã xác nhận email; không gửi email nào và không ghi mật khẩu vào log.
 * Email đã có tài khoản (vd. học viên) thì từ chối, không tự nâng quyền người đó.
 */
export async function createAccountAction(_previous: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");
  const fail = (message: string): CreateAccountState => ({ status: "error", message, email, role: roleRaw });

  const allowed = await checkAdminWrite();
  if (!allowed.ok) return fail(allowed.error);

  const limited = checkRateLimit(`create-account-ip:${await ipOfCaller()}`, CREATE_LIMIT_PER_IP);
  if (!limited.ok) return fail(`Bạn thao tác hơi nhanh, thử lại sau ${limited.retryAfterSec} giây.`);

  if (!email) return fail("Vui lòng nhập email.");
  if (!isValidEmail(email)) return fail(EMAIL_INVALID_MESSAGE);
  const role = parseAccountRole(roleRaw);
  if (!role) return fail("Vui lòng chọn vai trò hợp lệ.");
  const problem = passwordProblem(password);
  if (problem) return fail(problem);

  let result;
  try {
    result = await createStaffAccount(email, password, role);
  } catch (err) {
    console.error("[admin/accounts] Tạo tài khoản gặp lỗi không mong đợi:", err);
    return fail("Chưa tạo được tài khoản do lỗi hệ thống, thử lại sau.");
  }
  if (!result.ok) {
    if (result.reason === "email_exists") {
      return fail("Email này đã có tài khoản (có thể là tài khoản học viên). Hãy dùng email khác hoặc nhờ người phụ trách kỹ thuật cấp vai trò cho tài khoản có sẵn.");
    }
    if (result.reason === "weak_password") return fail(`Supabase từ chối mật khẩu này vì quá yếu. Hãy dùng mật khẩu dài và khó đoán hơn (tối thiểu ${MIN_PASSWORD_LENGTH} ký tự).`);
    return fail("Chưa tạo được tài khoản, thử lại sau ít phút.");
  }

  console.info(`[admin/accounts] Admin ${allowed.user.id} đã tạo tài khoản ${result.id} vai trò ${role}`);
  revalidatePath("/admin/accounts");
  return { status: "created", email, role };
}

/** Admin đổi vai trò của một tài khoản nội bộ khác. Chỉ admin; không tự đổi vai trò của mình; không hạ admin cuối cùng. */
export async function changeRoleAction(userId: string, newRoleRaw: string): Promise<ChangeRoleResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  const newRole = parseAccountRole(newRoleRaw);
  if (!newRole || !UUID_PATTERN.test(userId)) return { ok: false, error: "Dữ liệu gửi lên không hợp lệ." };

  const limited = checkRateLimit(`change-role-ip:${await ipOfCaller()}`, ROLE_LIMIT_PER_IP);
  if (!limited.ok) return { ok: false, error: `Bạn thao tác hơi nhanh, thử lại sau ${limited.retryAfterSec} giây.` };

  try {
    const target = await getStaffAccount(userId);
    const adminCount = (await listStaffAccounts()).filter((a) => a.role === "admin").length;
    const problem = roleChangeProblem({ actorId: allowed.user.id, targetId: userId, currentRole: target?.role ?? null, newRole, adminCount });
    if (problem) return { ok: false, error: problem };
    if (!(await setStaffAccountRole(userId, newRole))) return { ok: false, error: "Tài khoản không còn tồn tại. Hãy tải lại trang." };
  } catch (err) {
    console.error("[admin/accounts] Đổi vai trò thất bại:", err);
    return { ok: false, error: "Chưa đổi được vai trò do lỗi hệ thống, thử lại sau." };
  }

  console.info(`[admin/accounts] Admin ${allowed.user.id} đã đổi vai trò tài khoản ${userId} thành ${newRole}`);
  revalidatePath("/admin/accounts");
  return { ok: true, role: newRole };
}
