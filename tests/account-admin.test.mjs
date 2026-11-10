// Test logic thuần của quản lý tài khoản nội bộ (lib/account-admin.ts). Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { generatePassword, parseAccountRole, passwordProblem, roleChangeProblem } from "../lib/account-admin.ts";

test("parseAccountRole: chỉ nhận admin và nhan_vien", () => {
  assert.equal(parseAccountRole("admin"), "admin");
  assert.equal(parseAccountRole("nhan_vien"), "nhan_vien");
  for (const raw of ["", "Admin", "student", "root", null, undefined, 1, ["admin"]]) assert.equal(parseAccountRole(raw), null, String(raw));
});

test("passwordProblem: tối thiểu 12 ký tự, tối đa 72 byte, không toàn khoảng trắng", () => {
  assert.equal(passwordProblem("abcdefghijkl"), null);
  assert.equal(passwordProblem("a".repeat(72)), null);
  assert.match(passwordProblem(""), /nhập mật khẩu/);
  assert.match(passwordProblem(undefined), /nhập mật khẩu/);
  assert.match(passwordProblem("abcdefghijk"), /tối thiểu 12/);
  assert.match(passwordProblem("a".repeat(73)), /quá dài/);
  assert.match(passwordProblem("é".repeat(37)), /quá dài/, "tính theo byte, không theo ký tự");
  assert.match(passwordProblem(" ".repeat(20)), /khoảng trắng/);
});

test("generatePassword: đúng độ dài, đủ điều kiện mật khẩu, không có ký tự dễ nhầm, không lặp giữa các lần", () => {
  const fill = (bytes) => webcrypto.getRandomValues(bytes);
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const pw = generatePassword(fill);
    assert.equal(pw.length, 16);
    assert.equal(passwordProblem(pw), null);
    assert.doesNotMatch(pw, /[0OIl1]/);
    seen.add(pw);
  }
  assert.equal(seen.size, 200);
  assert.equal(generatePassword(fill, 24).length, 24);
});

test("generatePassword: byte lệch (>= ngưỡng) bị bỏ, nguồn trả toàn byte lệch thì vẫn tiếp tục hỏi", () => {
  let calls = 0;
  const fill = (bytes) => {
    calls++;
    bytes.fill(calls === 1 ? 255 : 0); // lần 1 toàn byte bị loại, lần 2 toàn 0 → ký tự đầu của bảng
    return bytes;
  };
  assert.equal(generatePassword(fill, 4), "AAAA");
  assert.equal(calls, 2);
});

const base = { actorId: "a", targetId: "b", currentRole: "nhan_vien", newRole: "admin", adminCount: 1 };

test("roleChangeProblem: cho phép thăng/hạ bình thường", () => {
  assert.equal(roleChangeProblem(base), null);
  assert.equal(roleChangeProblem({ ...base, currentRole: "admin", newRole: "nhan_vien", adminCount: 2 }), null);
});

test("roleChangeProblem: chặn tự đổi vai trò của chính mình", () => {
  assert.match(roleChangeProblem({ ...base, targetId: "a", currentRole: "admin", newRole: "nhan_vien", adminCount: 3 }), /tự đổi/);
});

test("roleChangeProblem: chặn hạ admin cuối cùng", () => {
  assert.match(roleChangeProblem({ ...base, currentRole: "admin", newRole: "nhan_vien", adminCount: 1 }), /admin cuối cùng/);
  assert.match(roleChangeProblem({ ...base, currentRole: "admin", newRole: "nhan_vien", adminCount: 0 }), /admin cuối cùng/);
});

test("roleChangeProblem: không phải tài khoản nội bộ, hoặc vai trò không đổi", () => {
  assert.match(roleChangeProblem({ ...base, currentRole: null }), /không phải tài khoản nội bộ/);
  assert.match(roleChangeProblem({ ...base, currentRole: "admin", newRole: "admin", adminCount: 2 }), /đã có vai trò này/);
});
