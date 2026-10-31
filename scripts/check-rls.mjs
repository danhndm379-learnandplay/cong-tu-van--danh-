// Kiểm tra RLS của student_profiles / student_documents bằng token đăng nhập THẬT của hai người dùng thử.
// Chạy từ thư mục gốc dự án: node scripts/check-rls.mjs   (cần SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY trong .env.local)
// CẢNH BÁO: chạy trên database THẬT của dự án. Script tạo hai người dùng thử (rls-a@example.com, rls-b@example.com), kiểm tra
// đọc/ghi chéo qua REST rồi xoá hai người dùng đó (hồ sơ + giấy tờ thử xoá theo nhờ on delete cascade). Không gửi email.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const URL_ = env.SUPABASE_URL, PUB = env.SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SECRET, opts);

const blocked = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0);
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${name}${detail ? "  → " + detail : ""}`); };

async function loginAs(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const anon = createClient(URL_, PUB, opts);
  const { data: s, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (e2) throw e2;
  return { id: s.user.id, token: s.session.access_token };
}

async function rest(token, method, path, body) {
  const headers = { apikey: PUB, "Content-Type": "application/json", Prefer: "return=representation" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text: text.slice(0, 140) };
}

const A = await loginAs("rls-a@example.com");
const B = await loginAs("rls-b@example.com");

// Dữ liệu mẫu do SERVER (secret key) ghi: mỗi người một hồ sơ + một giấy tờ.
const pa = (await admin.from("student_profiles").insert({ user_id: A.id }).select("id").single()).data.id;
const pb = (await admin.from("student_profiles").insert({ user_id: B.id }).select("id").single()).data.id;
await admin.from("student_documents").insert([
  { profile_id: pa, doc_type: "identity", full_name: "NGUOI DUNG A", document_number: "AAA111" },
  { profile_id: pb, doc_type: "identity", full_name: "NGUOI DUNG B", document_number: "BBB222" },
]);

// 1) Đọc hồ sơ
let r = await rest(A.token, "GET", "student_profiles?select=id,user_id");
check("A đọc student_profiles: chỉ thấy hồ sơ của mình", r.status === 200 && r.json.length === 1 && r.json[0].id === pa, `${r.json?.length} hàng`);
r = await rest(A.token, "GET", `student_profiles?id=eq.${pb}&select=id`);
check("A cố đọc hồ sơ của B bằng đúng id (biết địa chỉ trực tiếp): rỗng", r.status === 200 && r.json.length === 0);
r = await rest(A.token, "GET", `student_profiles?user_id=eq.${B.id}&select=id`);
check("A lọc theo user_id của B: rỗng", r.status === 200 && r.json.length === 0);
r = await rest(B.token, "GET", `student_profiles?id=eq.${pa}&select=id`);
check("B cố đọc hồ sơ của A: rỗng", r.status === 200 && r.json.length === 0);

// 2) Đọc giấy tờ (PII)
r = await rest(A.token, "GET", "student_documents?select=profile_id,full_name,document_number");
check("A đọc student_documents: chỉ thấy giấy tờ của mình", r.status === 200 && r.json.length === 1 && r.json[0].full_name === "NGUOI DUNG A", JSON.stringify(r.json));
r = await rest(A.token, "GET", `student_documents?profile_id=eq.${pb}&select=full_name,document_number`);
check("A cố đọc giấy tờ của B bằng profile_id: rỗng (không lộ họ tên/số giấy tờ)", r.status === 200 && r.json.length === 0);
r = await rest(B.token, "GET", "student_documents?select=full_name");
check("B đọc student_documents: chỉ thấy của B", r.status === 200 && r.json.length === 1 && r.json[0].full_name === "NGUOI DUNG B");

// 3) Không được ghi (kể cả vào hồ sơ của chính mình)
r = await rest(A.token, "PATCH", `student_profiles?id=eq.${pa}`, { scholarship_suggestions: { hack: true } });
check("A sửa hồ sơ của chính mình: bị từ chối và dữ liệu không đổi", blocked(r) && (await admin.from("student_profiles").select("scholarship_suggestions").eq("id", pa).single()).data.scholarship_suggestions === null, `HTTP ${r.status}`);
r = await rest(A.token, "PATCH", `student_documents?profile_id=eq.${pa}`, { full_name: "HACKED", ielts_overall: 9 });
check("A sửa điểm/giấy tờ của chính mình: bị từ chối và dữ liệu không đổi", blocked(r) && (await admin.from("student_documents").select("full_name, ielts_overall").eq("profile_id", pa).single()).data.full_name === "NGUOI DUNG A", `HTTP ${r.status}`);
r = await rest(A.token, "POST", "student_profiles", { user_id: A.id });
check("A tự tạo hồ sơ: bị từ chối", blocked(r) && !(r.json?.length > 0), `HTTP ${r.status}`);
r = await rest(A.token, "POST", "student_documents", { profile_id: pa, doc_type: "ielts", ielts_overall: 9 });
check("A tự thêm giấy tờ (điểm giả): bị từ chối", blocked(r) && !(r.json?.length > 0), `HTTP ${r.status}`);
r = await rest(A.token, "PATCH", `student_profiles?id=eq.${pb}`, { scholarship_suggestions: { hack: true } });
check("A sửa hồ sơ của B: bị từ chối và dữ liệu không đổi", blocked(r) && (await admin.from("student_profiles").select("scholarship_suggestions").eq("id", pb).single()).data.scholarship_suggestions === null, `HTTP ${r.status}`);
r = await rest(A.token, "DELETE", `student_profiles?id=eq.${pb}`);
check("A xoá hồ sơ của B: bị từ chối và hồ sơ của B còn nguyên", blocked(r) && (await admin.from("student_profiles").select("id").eq("id", pb)).data.length === 1, `HTTP ${r.status}`);

// 4) Chưa đăng nhập (chỉ có publishable key)
r = await rest(null, "GET", "student_profiles?select=id");
check("Chưa đăng nhập đọc student_profiles: bị từ chối", blocked(r), `HTTP ${r.status}`);
r = await rest(null, "GET", "student_documents?select=full_name");
check("Chưa đăng nhập đọc student_documents: bị từ chối", blocked(r), `HTTP ${r.status}`);

// 5) Người đăng nhập không được mở rộng sang các bảng riêng tư khác
for (const t of ["leads", "conversations", "messages", "quote_requests"]) {
  r = await rest(A.token, "GET", `${t}?select=id&limit=1`);
  const total = (await admin.from(t).select("id", { count: "exact", head: true })).count ?? 0;
  check(`A (học viên, không có vai trò) đọc bảng ${t}: không thấy hàng nào (bảng có ${total} hàng)`, blocked(r) && (r.status !== 200 || total > 0), `HTTP ${r.status}`);
}

// 6) Server (secret key) vẫn đọc/ghi được tất cả (để route ghi kết quả AI hoạt động)
const all = await admin.from("student_profiles").select("id");
check("Secret key (server) vẫn đọc được mọi hồ sơ", all.data.length >= 2, `${all.data.length} hồ sơ`);

// Dọn: xoá hai người dùng thử (hồ sơ + giấy tờ xoá theo nhờ on delete cascade) và kiểm tra cascade
await admin.auth.admin.deleteUser(A.id);
await admin.auth.admin.deleteUser(B.id);
const left = await admin.from("student_profiles").select("id", { count: "exact", head: true });
const leftDocs = await admin.from("student_documents").select("id", { count: "exact", head: true });
check("Xoá tài khoản thì hồ sơ + giấy tờ xoá theo (cascade)", left.count === 0 && leftDocs.count === 0, `còn ${left.count} hồ sơ, ${leftDocs.count} giấy tờ`);

console.log(`\n${results.filter(Boolean).length}/${results.length} kiểm tra đạt`);
process.exit(results.every(Boolean) ? 0 : 1);
