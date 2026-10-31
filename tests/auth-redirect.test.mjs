// Test logic thuần của đăng nhập magic link (lib/auth-redirect.ts, lib/auth-env.ts). Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { loginErrorFromSupabase, loginErrorMessage, parseOtpType, safeNextPath } from "../lib/auth-redirect.ts";
import { hasAuthSessionCookie } from "../lib/auth-env.ts";

test("safeNextPath: chỉ nhận đường dẫn nội bộ", () => {
  assert.equal(safeNextPath("/portal"), "/portal");
  assert.equal(safeNextPath("/portal?tab=1"), "/portal?tab=1");
  assert.equal(safeNextPath("/admin/requests"), "/admin/requests");
});

const BS = String.fromCharCode(92); // dấu gạch chéo ngược

test("safeNextPath: chặn open redirect và giá trị lạ, trả về mặc định", () => {
  const bad = [undefined, null, "", "portal", "//evil.com", "///evil.com", "https://evil.com", "http://evil.com/x", "/" + BS + "evil.com", BS + BS + "evil.com", "javascript:alert(1)", "/a\u0000b", "/a\nb", "/" + "a".repeat(300)];
  for (const raw of bad) assert.equal(safeNextPath(raw), "/portal", JSON.stringify(raw));
  assert.equal(safeNextPath("//evil.com", "/"), "/", "dùng đúng fallback được truyền vào");
});

test("parseOtpType: chỉ nhận loại token của magic link", () => {
  assert.equal(parseOtpType("email"), "email");
  assert.equal(parseOtpType("magiclink"), "magiclink");
  for (const raw of ["recovery", "invite", "signup", "", null, undefined, "EMAIL"]) assert.equal(parseOtpType(raw), null, String(raw));
});

test("thông điệp lỗi ở /login chỉ theo mã đã biết, không phản chiếu chuỗi người dùng", () => {
  assert.match(loginErrorMessage("link_invalid"), /không hợp lệ/);
  assert.match(loginErrorMessage("link_expired"), /hết hạn/);
  assert.match(loginErrorMessage(["link_expired", "x"]), /hết hạn/);
  for (const raw of ["<script>alert(1)</script>", "toString", "__proto__", "", null, undefined]) assert.equal(loginErrorMessage(raw), null, String(raw));
  assert.equal(loginErrorFromSupabase("otp_expired"), "link_expired");
  assert.equal(loginErrorFromSupabase("anything"), "link_invalid");
  assert.equal(loginErrorFromSupabase(null), "link_invalid");
});

test("hasAuthSessionCookie: nhận cookie phiên của @supabase/ssr, kể cả bị chia nhỏ", () => {
  assert.equal(hasAuthSessionCookie(["sb-abc-auth-token"]), true);
  assert.equal(hasAuthSessionCookie(["x", "sb-abc-auth-token.0", "sb-abc-auth-token.1"]), true);
  assert.equal(hasAuthSessionCookie(["sb-abc-auth-token-code-verifier"]), true);
  assert.equal(hasAuthSessionCookie(["duhoc24_student", "duhoc24_visitor"]), false);
  assert.equal(hasAuthSessionCookie([]), false);
});
