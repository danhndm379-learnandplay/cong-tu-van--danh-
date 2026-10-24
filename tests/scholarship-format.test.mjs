// Test định dạng học bổng và khớp tên trường (lib/scholarship-format.ts) cùng bộ kiểm tra gợi ý đã lưu. Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { conditionText, normalizeName, schoolNameMatches, supportText } from "../lib/scholarship-format.ts";
import { parseStoredAdvice } from "../lib/scholarship-advice.ts";

test("định dạng điều kiện và mức hỗ trợ", () => {
  assert.equal(conditionText("gpa", 8), "Điểm học tập từ 8.0 (thang 10)");
  assert.equal(conditionText("ielts", 7), "IELTS từ 7.0");
  assert.equal(conditionText("gpa", 7.5), "Điểm học tập từ 7.5 (thang 10)");
  assert.equal(supportText("percent", 25), "Hỗ trợ 25% học phí");
  assert.equal(supportText("percent", 12.5), "Hỗ trợ 12.5% học phí");
  assert.equal(supportText("full", null), "Hỗ trợ toàn phần");
});

test("khớp tên trường khi AI/người dùng gõ khác dấu hoặc viết tắt", () => {
  assert.equal(normalizeName("  Đại   học  DEAKIN "), "dai hoc deakin");
  assert.equal(schoolNameMatches("Đại học Deakin", "Đại học Deakin"), true);
  assert.equal(schoolNameMatches("Đại học Deakin", "dai hoc deakin"), true);
  assert.equal(schoolNameMatches("Đại học Deakin", "Deakin"), true);
  assert.equal(schoolNameMatches("Đại học Deakin", "Đại học Melbourne"), false);
  assert.equal(schoolNameMatches("Đại học Deakin", "  "), false);
});

test("parseStoredAdvice: chỉ nhận dữ liệu đúng dạng", () => {
  const good = {
    summary: "ok",
    model: "m",
    lookups: [{ schoolName: "Đại học Deakin", found: 1 }],
    items: [{ scholarshipId: "1", school: "S", country: "C", name: "N", condition: "c", support: "s", eligible: true, reason: "r" }],
  };
  assert.deepEqual(parseStoredAdvice(good), good);
  assert.equal(parseStoredAdvice(null), null);
  assert.equal(parseStoredAdvice({ ...good, items: [{ ...good.items[0], eligible: "yes" }] }), null);
  assert.equal(parseStoredAdvice({ ...good, lookups: [{ schoolName: 1, found: 1 }] }), null);
  assert.equal(parseStoredAdvice({ summary: 1 }), null);
});
