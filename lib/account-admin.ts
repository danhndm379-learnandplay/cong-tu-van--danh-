// Quản lý tài khoản nội bộ (logic thuần, không import runtime nên test trực tiếp bằng Node: tests/account-admin.test.mjs).
// Việc gọi Supabase nằm ở lib/staff-account-store.ts; quyền (chỉ admin) kiểm tra ở app/admin/accounts/actions.ts.

export type AccountRole = "admin" | "nhan_vien";

export const MIN_PASSWORD_LENGTH = 12;
// Supabase băm mật khẩu bằng bcrypt, chỉ đọc 72 byte đầu; quá dài thì phần sau bị bỏ qua mà người dùng không biết.
export const MAX_PASSWORD_BYTES = 72;

/** Chỉ nhận đúng hai vai trò quản trị; mọi giá trị khác (rỗng, lạ, "student") là không hợp lệ. */
export function parseAccountRole(value: unknown): AccountRole | null {
  return value === "admin" || value === "nhan_vien" ? value : null;
}

/** Lý do mật khẩu không đạt, hoặc null nếu hợp lệ. Chỉ kiểm tra độ dài (chưa có kiểm tra độ mạnh theo yêu cầu). */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) return "Vui lòng nhập mật khẩu.";
  if (password.length < MIN_PASSWORD_LENGTH) return `Mật khẩu cần tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return `Mật khẩu quá dài (tối đa ${MAX_PASSWORD_BYTES} byte).`;
  if (password.trim().length === 0) return "Mật khẩu không được chỉ gồm khoảng trắng.";
  return null;
}

// Bỏ các ký tự dễ nhầm (0/O, 1/l/I) vì mật khẩu thường được đọc hoặc gõ lại bằng tay khi gửi cho đồng nghiệp.
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Mật khẩu ngẫu nhiên 16 ký tự. `fillRandom` là nguồn ngẫu nhiên an toàn (crypto.getRandomValues của trình duyệt/Node).
 * Dùng loại bỏ giá trị lệch (rejection sampling) để mọi ký tự có xác suất bằng nhau.
 */
export function generatePassword(fillRandom: (bytes: Uint8Array) => Uint8Array, length = 16): string {
  const alphabetSize = PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % alphabetSize); // byte >= limit bị bỏ để không lệch
  let out = "";
  while (out.length < length) {
    for (const byte of fillRandom(new Uint8Array(length * 2))) {
      if (byte >= limit) continue;
      out += PASSWORD_ALPHABET[byte % alphabetSize];
      if (out.length === length) break;
    }
  }
  return out;
}

export interface RoleChangeInput {
  actorId: string;
  targetId: string;
  /** Vai trò hiện tại của người bị đổi; null nếu họ không phải tài khoản nội bộ. */
  currentRole: AccountRole | null;
  newRole: AccountRole;
  /** Số admin đang có (tính cả người bị đổi). */
  adminCount: number;
}

/**
 * Có được đổi vai trò không. Trả về lý do từ chối hoặc null nếu được.
 *  - chỉ đổi cho tài khoản nội bộ (không biến học viên thành nhân viên qua đường này);
 *  - không tự đổi vai trò của chính mình (tránh tự hạ quyền rồi khoá luôn đội);
 *  - không hạ admin cuối cùng (phòng khi hai admin cùng bấm hạ quyền nhau).
 */
export function roleChangeProblem(input: RoleChangeInput): string | null {
  if (input.currentRole === null) return "Tài khoản này không phải tài khoản nội bộ.";
  if (input.actorId === input.targetId) return "Bạn không thể tự đổi vai trò của chính mình. Hãy nhờ một admin khác.";
  if (input.currentRole === input.newRole) return "Tài khoản đã có vai trò này.";
  if (input.currentRole === "admin" && input.newRole !== "admin" && input.adminCount <= 1) {
    return "Đây là admin cuối cùng, không thể hạ quyền.";
  }
  return null;
}
