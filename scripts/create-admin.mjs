// Tạo tài khoản quản trị (email + mật khẩu) trong Supabase Auth. Không có trang đăng ký công khai: đội tự tạo sẵn bằng script này.
//
//   node scripts/create-admin.mjs <email>                       tạo tài khoản ADMIN với mật khẩu ngẫu nhiên (in ra MỘT lần)
//   node scripts/create-admin.mjs <email> --role nhan_vien      tạo tài khoản NHÂN VIÊN (chỉ xem, không sửa/xoá được)
//   node scripts/create-admin.mjs <email> --password "<mk>"     tự chọn mật khẩu (tối thiểu 12 ký tự)
//   node scripts/create-admin.mjs <email> --force               email đã có tài khoản (vd. học viên): đặt mật khẩu mới + cấp vai trò
//
// Cần SUPABASE_URL và SUPABASE_SECRET_KEY trong .env.local (chạy từ thư mục gốc dự án). Script chạy trên database THẬT.
// Vai trò = app_metadata.role: "admin" (xem, sửa, xoá) hoặc "nhan_vien" (chỉ xem). Trường này chỉ secret key/SQL Editor của Supabase sửa
// được, người dùng tự sửa thì không. Database (RLS) cũng dựa vào vai trò này để chặn sửa/xoá. Vai trò nằm trong token đăng nhập nên đổi vai
// trò chỉ có hiệu lực sau khi người đó đăng nhập lại (tối đa ~1 giờ).
// Muốn thu hồi quyền: xoá tài khoản trong Supabase Dashboard → Authentication → Users, hoặc đặt lại role bằng SQL Editor.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--password" && args[args.indexOf(a) - 1] !== "--role")?.trim();
const force = args.includes("--force");
const pwIndex = args.indexOf("--password");
const givenPassword = pwIndex >= 0 ? args[pwIndex + 1] : undefined;
const roleIndex = args.indexOf("--role");
const role = roleIndex >= 0 ? args[roleIndex + 1] : "admin";

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error('Cách dùng: node scripts/create-admin.mjs <email> [--role admin|nhan_vien] [--password "<mật khẩu>"] [--force]');
  process.exit(1);
}
if (role !== "admin" && role !== "nhan_vien") {
  console.error('--role chỉ nhận "admin" hoặc "nhan_vien".');
  process.exit(1);
}
if (pwIndex >= 0 && (!givenPassword || givenPassword.length < 12)) {
  console.error("Mật khẩu tự chọn phải có ít nhất 12 ký tự.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
  console.error("Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong .env.local");
  process.exit(1);
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const generated = !givenPassword;
// 24 ký tự base64url từ 18 byte ngẫu nhiên của hệ điều hành (~144 bit).
const password = givenPassword ?? randomBytes(18).toString("base64url");

const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (existing && !force) {
  console.error(`Email ${email} đã có tài khoản (tạo ${existing.created_at}). Nếu đúng là muốn đặt mật khẩu và cấp vai trò cho tài khoản này, chạy lại với --force.`);
  process.exit(1);
}

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: { ...existing.app_metadata, role },
  });
  if (error) throw error;
  console.log(`Đã cấp vai trò ${role} và đặt mật khẩu mới cho tài khoản có sẵn: ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } });
  if (error) throw error;
  console.log(`Đã tạo tài khoản ${role}: ${email}`);
}
if (generated) {
  console.log(`Mật khẩu (chỉ hiện MỘT lần, hãy lưu vào trình quản lý mật khẩu): ${password}`);
}
console.log("Đăng nhập tại /admin/login");
