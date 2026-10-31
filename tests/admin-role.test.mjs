// Test phân quyền admin (lib/admin-role.ts): vai trò chỉ lấy từ app_metadata, đường dẫn ?next= an toàn. Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { adminLoginUrl, isAdminRole, safeAdminNextPath } from "../lib/admin-role.ts";

const BS = String.fromCharCode(92); // dấu gạch chéo ngược

test("isAdminRole: chỉ app_metadata.role === 'admin' mới là admin", () => {
  assert.equal(isAdminRole({ role: "admin" }), true);
  assert.equal(isAdminRole({ role: "admin", provider: "email" }), true);
  for (const bad of [undefined, null, {}, { role: "Admin" }, { role: "ADMIN" }, { role: "user" }, { role: ["admin"] }, { roles: ["admin"] }, { role: true }, "admin", 1, []]) {
    assert.equal(isAdminRole(bad), false, JSON.stringify(bad));
  }
});

test("safeAdminNextPath: chỉ nhận đường dẫn nội bộ trong /admin", () => {
  assert.equal(safeAdminNextPath("/admin/conversations"), "/admin/conversations");
  assert.equal(safeAdminNextPath("/admin/conversations/123?x=1"), "/admin/conversations/123?x=1");
  assert.equal(safeAdminNextPath("/admin"), "/admin");
});

test("safeAdminNextPath: chặn open redirect, trang ngoài /admin và vòng lặp về trang đăng nhập", () => {
  const bad = [undefined, null, "", "admin/requests", "//evil.com", "///admin", "https://evil.com/admin", "/portal", "/", "/administrator", "/admin/login", "/admin/login/x", "/admin/login?next=/admin",
    "/" + BS + "evil.com", "/admin" + BS + "x", "/admin\nx", "/admin\u0000", "/" + "a".repeat(300)];
  for (const raw of bad) assert.equal(safeAdminNextPath(raw), "/admin/requests", JSON.stringify(raw));
});

test("adminLoginUrl: kèm ?next= đã mã hoá, trang mặc định thì không kèm", () => {
  assert.equal(adminLoginUrl(), "/admin/login");
  assert.equal(adminLoginUrl("/admin/requests"), "/admin/login");
  assert.equal(adminLoginUrl("/admin/conversations?quality=good"), "/admin/login?next=%2Fadmin%2Fconversations%3Fquality%3Dgood");
  assert.equal(adminLoginUrl("https://evil.com"), "/admin/login");
});

import { canModifyData, isStaffRole, staffRole } from "../lib/admin-role.ts";

test("staffRole / isStaffRole: chỉ 'admin' và 'nhan_vien' trong app_metadata mới là vai trò quản trị", () => {
  assert.equal(staffRole({ role: "admin" }), "admin");
  assert.equal(staffRole({ role: "nhan_vien", provider: "email" }), "nhan_vien");
  assert.equal(isStaffRole({ role: "admin" }), true);
  assert.equal(isStaffRole({ role: "nhan_vien" }), true);
  for (const bad of [undefined, null, {}, { role: "Admin" }, { role: "NHAN_VIEN" }, { role: "nhan-vien" }, { role: "user" }, { role: ["admin"] }, { roles: ["admin"] }, "admin", 1, []]) {
    assert.equal(staffRole(bad), null, JSON.stringify(bad));
    assert.equal(isStaffRole(bad), false, JSON.stringify(bad));
  }
});

test("canModifyData: chỉ admin được sửa/xoá, nhân viên và người khác thì không", () => {
  assert.equal(canModifyData("admin"), true);
  assert.equal(canModifyData("nhan_vien"), false);
  assert.equal(canModifyData(null), false);
  assert.equal(canModifyData(undefined), false);
});
