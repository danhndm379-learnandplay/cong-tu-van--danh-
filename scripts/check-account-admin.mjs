// Kiểm chứng các giả định về Supabase Auth mà trang quản lý tài khoản nội bộ (/admin/accounts) dựa vào, bằng token THẬT:
//   - tạo tài khoản email + mật khẩu với vai trò ở app_metadata và đăng nhập được ngay (không cần xác nhận email);
//   - tạo trùng email trả về mã lỗi mà code chờ (`email_exists`);
//   - đổi vai trò bằng getUserById + updateUserById giữ nguyên các khoá khác của app_metadata;
//   - đổi vai trò, khoá hoặc xoá tài khoản có hiệu lực NGAY ở cả chốt chặn của site (getUser()) lẫn RLS ở database, kể cả khi người đó
//     vẫn giữ token cũ (migration role_rls_read_role_from_database: RLS tra vai trò hiện tại trong auth.users, không tin vai trò trong token).
//
// Chạy từ thư mục gốc dự án: node scripts/check-account-admin.mjs   (cần SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY trong .env.local)
// CẢNH BÁO: chạy trên database THẬT. Tạo 1-2 tài khoản thử (@example.com, mật khẩu ngẫu nhiên không in ra) và một dòng yêu cầu báo giá mẫu,
// rồi xoá sạch. Không gửi email.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const URL_ = env.SUPABASE_URL, PUB = env.SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(URL_, SECRET, opts);
const tag = randomBytes(3).toString("hex");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${name}${detail ? "  → " + detail : ""}`); };

async function signIn(email, password) {
  const { data, error } = await createClient(URL_, PUB, opts).auth.signInWithPassword({ email, password });
  return { error, token: data?.session?.access_token, claim: data?.user?.app_metadata?.role ?? null };
}
async function rest(token, method, path, body) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { apikey: PUB, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}
const changed = (r) => r.status < 300 && Array.isArray(r.json) && r.json.length > 0;

const email = `acctcheck-${tag}@example.com`;
const password = randomBytes(18).toString("base64url");
let userId, quoteId;
try {
  // 1) Tạo tài khoản như createStaffAccount (có thêm một khoá app_metadata khác để thử việc giữ nguyên khoá khi đổi vai trò)
  const created = await server.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "nhan_vien", ghi_chu: "giu-lai" } });
  check("Tạo tài khoản nhân viên bằng email + mật khẩu", !created.error, created.error?.message);
  userId = created.data?.user?.id;

  const first = await signIn(email, password);
  check("Đăng nhập được ngay bằng mật khẩu vừa đặt (không cần xác nhận email) và JWT mang vai trò nhan_vien", !first.error && first.claim === "nhan_vien", first.error?.message);

  // 2) Tạo trùng email
  const dup = await server.auth.admin.createUser({ email, password: randomBytes(18).toString("base64url"), email_confirm: true, app_metadata: { role: "admin" } });
  check("Tạo trùng email bị từ chối với mã lỗi email_exists", !!dup.error && (dup.error.code === "email_exists" || dup.error.code === "user_already_exists"), `code=${dup.error?.code}, status=${dup.error?.status}`);
  const dupEmailCase = await server.auth.admin.createUser({ email: email.toUpperCase(), password: randomBytes(18).toString("base64url"), email_confirm: true });
  check("Email khác hoa/thường cũng bị coi là trùng", !!dupEmailCase.error, `code=${dupEmailCase.error?.code}`);

  // 3) Danh sách: tài khoản nội bộ có trong listUsers kèm vai trò
  let found = null;
  for (let page = 1; page <= 25 && !found; page++) {
    const { data } = await server.auth.admin.listUsers({ page, perPage: 200 });
    found = data.users.find((u) => u.id === userId) ?? null;
    if (data.users.length < 200) break;
  }
  check("listUsers trả về tài khoản mới cùng app_metadata.role", found?.app_metadata?.role === "nhan_vien", `role=${found?.app_metadata?.role}`);

  // 4) RLS với token CŨ trước khi đổi vai trò: nhân viên không sửa được yêu cầu báo giá
  quoteId = (await server.from("quote_requests").insert({ customer_name: "ACCTCHECK", email: "ac@example.com", study_country: "Úc", education_level: "dai_hoc", service_package: "co_ban", price: 1 }).select("id").single()).data.id;
  check("Nhân viên (token cũ) chưa sửa được yêu cầu báo giá", !changed(await rest(first.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 2 })));

  // 5) Đổi vai trò như setStaffAccountRole (giữ nguyên khoá khác)
  const current = await server.auth.admin.getUserById(userId);
  const upd = await server.auth.admin.updateUserById(userId, { app_metadata: { ...current.data.user.app_metadata, role: "admin" } });
  check("Đổi vai trò sang admin", !upd.error, upd.error?.message);
  const after = (await server.auth.admin.getUserById(userId)).data.user.app_metadata;
  check("Khoá app_metadata khác được giữ nguyên sau khi đổi vai trò", after.role === "admin" && after.ghi_chu === "giu-lai", JSON.stringify(after));

  // 6) Hiệu lực NGAY, không cần token mới: getUser() và RLS đều thấy vai trò mới
  const viaGetUser = await createClient(URL_, PUB, opts).auth.getUser(first.token);
  check("getUser() (chốt chặn trang/Server Action) thấy vai trò MỚI ngay với token cũ", viaGetUser.data?.user?.app_metadata?.role === "admin", `role=${viaGetUser.data?.user?.app_metadata?.role}`);
  check("RLS cũng theo vai trò mới ngay: token cũ (JWT ghi nhan_vien) giờ sửa được vì đã thành admin", changed(await rest(first.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 2 })));

  // 7) Hạ lại nhân viên: token đang giữ (JWT vẫn ghi admin) phải mất quyền sửa ngay
  const second = await signIn(email, password);
  check("Trước khi hạ quyền: token mang vai trò admin và sửa được", second.claim === "admin" && changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 3 })));
  const demote = await server.auth.admin.updateUserById(userId, { app_metadata: { ...after, role: "nhan_vien" } });
  check("Hạ quyền xong: token cũ (JWT vẫn ghi admin) KHÔNG còn sửa được ngay lập tức", !demote.error && !changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 4 })));
  const stillReads = await rest(second.token, "GET", `quote_requests?id=eq.${quoteId}&select=id`);
  check("... nhưng vẫn xem được (nhân viên được xem)", stillReads.status === 200 && stillReads.json?.length === 1);

  // 8) Khoá tài khoản (ban): token cũ mất quyền ngay, gỡ khoá thì có lại
  await server.auth.admin.updateUserById(userId, { app_metadata: { ...after, role: "admin" } });
  check("Cấp lại admin: sửa được ngay", changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 5 })));
  await server.auth.admin.updateUserById(userId, { ban_duration: "1h" });
  const bannedRead = await rest(second.token, "GET", `quote_requests?id=eq.${quoteId}&select=id`);
  check("Tài khoản bị khoá: token cũ không đọc/sửa được nữa", (bannedRead.json?.length ?? 0) === 0 && !changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 6 })));
  await server.auth.admin.updateUserById(userId, { ban_duration: "none" });
  check("Gỡ khoá: có quyền lại", changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 7 })));

  // 9) Xoá tài khoản: token cũ mất quyền ngay (chưa hết hạn nhưng người dùng không còn)
  await server.auth.admin.deleteUser(userId);
  const deletedRead = await rest(second.token, "GET", `quote_requests?id=eq.${quoteId}&select=id`);
  check("Tài khoản bị xoá: token cũ không đọc/sửa được nữa", (deletedRead.json?.length ?? 0) === 0 && !changed(await rest(second.token, "PATCH", `quote_requests?id=eq.${quoteId}`, { price: 8 })));
  userId = null; // đã xoá, không xoá lại ở bước dọn
} catch (err) {
  check("Script chạy không lỗi", false, err?.message ?? String(err));
} finally {
  if (quoteId) await server.from("quote_requests").delete().eq("id", quoteId);
  if (userId) await server.auth.admin.deleteUser(userId);
  const { data } = await server.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const left = data.users.filter((u) => u.email?.startsWith(`acctcheck-${tag}`)).length;
  console.log(`\nĐã dọn tài khoản thử. Còn lại: ${left}.`);
}

const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} kiểm tra đạt`);
process.exit(passed === results.length ? 0 : 1);
