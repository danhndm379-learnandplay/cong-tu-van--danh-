// Kiểm tra RLS theo VAI TRÒ (admin / nhân viên / học viên / chưa đăng nhập) trên các bảng quản trị bằng token đăng nhập THẬT,
// gọi thẳng REST của Supabase (kiểu "gọi thẳng vào hệ thống", bỏ qua giao diện và Server Action của site).
//
// Chạy từ thư mục gốc dự án: node scripts/check-role-rls.mjs   (cần SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY trong .env.local)
// CẢNH BÁO: chạy trên database THẬT. Script tạo 4 tài khoản thử (@example.com, mật khẩu ngẫu nhiên mỗi lần chạy, không in ra) gồm admin,
// nhân viên, học viên thường và một học viên chủ hồ sơ, cùng vài dòng dữ liệu mẫu; thử đọc/thêm/sửa/xoá; rồi xoá sạch. Không gửi email.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const URL_ = env.SUPABASE_URL, PUB = env.SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(URL_, SECRET, opts); // đóng vai SERVER (service_role) để tạo dữ liệu mẫu và kiểm chứng kết quả
const tag = randomBytes(3).toString("hex");
const newConversation = () => ({ visitor_token_hash: randomBytes(32).toString("hex") }); // cột bắt buộc: sha256 của token khách

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✔" : "✘"} ${name}${detail ? "  → " + detail : ""}`); };

// ---- Tài khoản thử ----
const accounts = {};
async function makeUser(label, appMetadata) {
  const email = `rolecheck-${label}-${tag}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await server.auth.admin.createUser({ email, password, email_confirm: true, ...(appMetadata ? { app_metadata: appMetadata } : {}) });
  if (error) throw error;
  const anon = createClient(URL_, PUB, opts);
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  accounts[label] = { id: data.user.id, token: s.session.access_token, claim: s.user.app_metadata?.role ?? null };
}

async function rest(token, method, path, body) {
  const headers = { apikey: PUB, "Content-Type": "application/json", Prefer: "return=representation" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}
const denied = (r) => r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0);
const changed = (r) => r.status < 300 && Array.isArray(r.json) && r.json.length > 0;

let convId, quoteId, profileId, docId;
try {
  await makeUser("admin", { role: "admin" });
  await makeUser("staff", { role: "nhan_vien" });
  await makeUser("student", null);
  await makeUser("owner", null); // học viên chủ của hồ sơ mẫu
  check("Token của admin/nhân viên mang đúng vai trò trong JWT, học viên thì không", accounts.admin.claim === "admin" && accounts.staff.claim === "nhan_vien" && accounts.student.claim === null);

  // ---- Dữ liệu mẫu (do SERVER ghi) ----
  convId = (await server.from("conversations").insert(newConversation()).select("id").single()).data.id;
  await server.from("messages").insert({ conversation_id: convId, role: "user", content: "tin nhan mau" });
  await server.from("leads").insert({ conversation_id: convId, name: "LEAD MAU", quality: "ok" });
  quoteId = (await server.from("quote_requests").insert({ customer_name: "ROLECHECK", email: "rc@example.com", study_country: "Úc", education_level: "dai_hoc", service_package: "co_ban", price: 1 }).select("id").single()).data.id;
  profileId = (await server.from("student_profiles").insert({ user_id: accounts.owner.id }).select("id").single()).data.id;
  docId = (await server.from("student_documents").insert({ profile_id: profileId, doc_type: "identity", full_name: "NGUOI MAU", document_number: "ROLE123" }).select("id").single()).data.id;

  const A = accounts.admin.token, S = accounts.staff.token, ST = accounts.student.token;

  // ---- 1) ĐỌC ----
  const reads = [
    ["conversations", `conversations?id=eq.${convId}&select=id`],
    ["messages", `messages?conversation_id=eq.${convId}&select=id`],
    ["leads", `leads?conversation_id=eq.${convId}&select=id`],
    ["quote_requests", `quote_requests?id=eq.${quoteId}&select=id`],
    ["student_profiles", `student_profiles?id=eq.${profileId}&select=id`],
    ["student_documents", `student_documents?profile_id=eq.${profileId}&select=id,full_name`],
  ];
  for (const [table, path] of reads) {
    check(`ĐỌC ${table}: admin thấy`, (await rest(A, "GET", path)).json?.length === 1);
    check(`ĐỌC ${table}: nhân viên thấy`, (await rest(S, "GET", path)).json?.length === 1);
    check(`ĐỌC ${table}: học viên thường KHÔNG thấy`, denied(await rest(ST, "GET", path)));
    check(`ĐỌC ${table}: chưa đăng nhập bị chặn`, denied(await rest(null, "GET", path)));
  }

  // ---- 2) SỬA ----
  const updates = [
    ["quote_requests", `quote_requests?id=eq.${quoteId}`, { status: "da_duyet" }, async () => (await server.from("quote_requests").select("status").eq("id", quoteId).single()).data.status === "da_duyet", async () => server.from("quote_requests").update({ status: "cho_duyet" }).eq("id", quoteId)],
    ["student_documents", `student_documents?id=eq.${docId}`, { full_name: "DA BI SUA", ielts_overall: 9 }, async () => (await server.from("student_documents").select("full_name").eq("id", docId).single()).data.full_name === "DA BI SUA", async () => server.from("student_documents").update({ full_name: "NGUOI MAU", ielts_overall: null }).eq("id", docId)],
    ["student_profiles", `student_profiles?id=eq.${profileId}`, { scholarship_suggestions: { x: 1 } }, async () => (await server.from("student_profiles").select("scholarship_suggestions").eq("id", profileId).single()).data.scholarship_suggestions !== null, async () => server.from("student_profiles").update({ scholarship_suggestions: null }).eq("id", profileId)],
    ["leads", `leads?conversation_id=eq.${convId}`, { name: "LEAD DA SUA" }, async () => (await server.from("leads").select("name").eq("conversation_id", convId).single()).data.name === "LEAD DA SUA", async () => server.from("leads").update({ name: "LEAD MAU" }).eq("conversation_id", convId)],
  ];
  for (const [table, path, patch, wasChanged, restore] of updates) {
    let r = await rest(S, "PATCH", path, patch);
    check(`SỬA ${table}: nhân viên bị chặn và dữ liệu không đổi`, denied(r) && !(await wasChanged()), `HTTP ${r.status}`);
    r = await rest(ST, "PATCH", path, patch);
    check(`SỬA ${table}: học viên thường bị chặn và dữ liệu không đổi`, denied(r) && !(await wasChanged()), `HTTP ${r.status}`);
    r = await rest(null, "PATCH", path, patch);
    check(`SỬA ${table}: chưa đăng nhập bị chặn`, denied(r) && !(await wasChanged()), `HTTP ${r.status}`);
    r = await rest(A, "PATCH", path, patch);
    check(`SỬA ${table}: admin sửa được`, changed(r) && (await wasChanged()), `HTTP ${r.status}`);
    await restore();
  }

  // ---- 3) THÊM (chỉ bảng leads cho phép admin thêm; các bảng khác không ai ngoài server được thêm) ----
  const newConv = (await server.from("conversations").insert(newConversation()).select("id").single()).data.id;
  const leadBody = { conversation_id: newConv, name: "LEAD THEM", quality: "ok" };
  check("THÊM leads: nhân viên bị chặn", !changed(await rest(S, "POST", "leads", leadBody)));
  check("THÊM leads: học viên thường bị chặn", !changed(await rest(ST, "POST", "leads", leadBody)));
  check("THÊM leads: admin thêm được", changed(await rest(A, "POST", "leads", leadBody)));
  for (const [token, who] of [[A, "admin"], [S, "nhân viên"]]) {
    check(`THÊM quote_requests: ${who} bị chặn (chỉ server nhận yêu cầu từ khách)`, !changed(await rest(token, "POST", "quote_requests", { customer_name: "X", email: "x@example.com", study_country: "Úc", education_level: "dai_hoc", service_package: "co_ban", price: 1 })));
    check(`THÊM student_profiles: ${who} bị chặn`, !changed(await rest(token, "POST", "student_profiles", { user_id: accounts.student.id })));
    check(`THÊM student_documents: ${who} bị chặn (điểm do AI đọc, không tự thêm)`, !changed(await rest(token, "POST", "student_documents", { profile_id: profileId, doc_type: "ielts", ielts_overall: 9 })));
    check(`THÊM conversations: ${who} bị chặn`, !changed(await rest(token, "POST", "conversations", newConversation())));
  }
  await server.from("conversations").delete().eq("id", newConv);

  // ---- 4) XOÁ ----
  const deletes = [
    ["quote_requests", `quote_requests?id=eq.${quoteId}`, async () => (await server.from("quote_requests").select("id").eq("id", quoteId)).data.length === 1],
    ["student_documents", `student_documents?id=eq.${docId}`, async () => (await server.from("student_documents").select("id").eq("id", docId)).data.length === 1],
    ["student_profiles", `student_profiles?id=eq.${profileId}`, async () => (await server.from("student_profiles").select("id").eq("id", profileId)).data.length === 1],
    ["conversations", `conversations?id=eq.${convId}`, async () => (await server.from("conversations").select("id").eq("id", convId)).data.length === 1],
    ["leads", `leads?conversation_id=eq.${convId}`, async () => (await server.from("leads").select("id").eq("conversation_id", convId)).data.length === 1],
    ["messages", `messages?conversation_id=eq.${convId}`, async () => (await server.from("messages").select("id").eq("conversation_id", convId)).data.length === 1],
  ];
  for (const [table, path, stillThere] of deletes) {
    let r = await rest(S, "DELETE", path);
    check(`XOÁ ${table}: nhân viên bị chặn và dữ liệu còn nguyên`, denied(r) && (await stillThere()), `HTTP ${r.status}`);
    r = await rest(ST, "DELETE", path);
    check(`XOÁ ${table}: học viên thường bị chặn và dữ liệu còn nguyên`, denied(r) && (await stillThere()), `HTTP ${r.status}`);
    r = await rest(null, "DELETE", path);
    check(`XOÁ ${table}: chưa đăng nhập bị chặn và dữ liệu còn nguyên`, denied(r) && (await stillThere()), `HTTP ${r.status}`);
  }
  check("XOÁ messages: ngay cả admin cũng không xoá lẻ tin nhắn (chỉ xoá theo cả cuộc trò chuyện)", denied(await rest(A, "DELETE", `messages?conversation_id=eq.${convId}`)) && (await server.from("messages").select("id").eq("conversation_id", convId)).data.length === 1);
  // Admin xoá thật (đến cuối, vì xoá là vĩnh viễn)
  check("XOÁ quote_requests: admin xoá được", changed(await rest(A, "DELETE", `quote_requests?id=eq.${quoteId}`)) && (await server.from("quote_requests").select("id").eq("id", quoteId)).data.length === 0);
  check("XOÁ student_documents: admin xoá được", changed(await rest(A, "DELETE", `student_documents?id=eq.${docId}`)) && (await server.from("student_documents").select("id").eq("id", docId)).data.length === 0);
  check("XOÁ student_profiles: admin xoá được", changed(await rest(A, "DELETE", `student_profiles?id=eq.${profileId}`)) && (await server.from("student_profiles").select("id").eq("id", profileId)).data.length === 0);
  check("XOÁ conversations: admin xoá được, tin nhắn và lead xoá theo", changed(await rest(A, "DELETE", `conversations?id=eq.${convId}`))
    && (await server.from("conversations").select("id").eq("id", convId)).data.length === 0
    && (await server.from("messages").select("id").eq("conversation_id", convId)).data.length === 0
    && (await server.from("leads").select("id").eq("conversation_id", convId)).data.length === 0);

  // ---- 5) Tự nâng quyền không được ----
  const staffClient = createClient(URL_, PUB, opts);
  await staffClient.auth.setSession({ access_token: S, refresh_token: "x" }).catch(() => {});
  const put = await fetch(`${URL_}/auth/v1/user`, { method: "PUT", headers: { apikey: PUB, Authorization: `Bearer ${S}`, "Content-Type": "application/json" }, body: JSON.stringify({ app_metadata: { role: "admin" } }) });
  check("Nhân viên tự ghi app_metadata.role = admin: bị chặn", put.status === 403 || put.status === 401, `HTTP ${put.status}`);
  const putUser = await fetch(`${URL_}/auth/v1/user`, { method: "PUT", headers: { apikey: PUB, Authorization: `Bearer ${S}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { role: "admin" } }) });
  const body = await putUser.json();
  check("Nhân viên tự ghi user_metadata.role = admin được (như dự kiến) nhưng app_metadata.role vẫn là nhan_vien", putUser.status === 200 && body.app_metadata?.role === "nhan_vien", `user_metadata.role=${body.user_metadata?.role}, app_metadata.role=${body.app_metadata?.role}`);
  const anonStudent = createClient(URL_, PUB, opts);
  const q = await rest(S, "PATCH", `quote_requests?customer_name=eq.ROLECHECK`, { status: "da_duyet" });
  check("Sau khi tự sửa user_metadata, nhân viên vẫn không sửa được dữ liệu", denied(q));
  void anonStudent;
} finally {
  // ---- Dọn ----
  if (convId) await server.from("conversations").delete().eq("id", convId);
  if (quoteId) await server.from("quote_requests").delete().eq("id", quoteId);
  await server.from("quote_requests").delete().eq("customer_name", "ROLECHECK");
  for (const a of Object.values(accounts)) await server.auth.admin.deleteUser(a.id);
  const p = await server.from("student_profiles").select("id", { count: "exact", head: true });
  console.log(`\nĐã dọn tài khoản thử. Hồ sơ học viên còn lại: ${p.count}.`);
}

console.log(`${results.filter(Boolean).length}/${results.length} kiểm tra đạt`);
process.exit(results.every(Boolean) ? 0 : 1);
