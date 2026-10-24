// Test logic thuần: làm sạch dữ liệu Gemini, kiểm tra đủ/thiếu/hợp lệ của giấy tờ (lib/portal-docs.ts).
// Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FIELDS as E,
  evaluateDocument,
  evaluateProfile,
  expectedIeltsOverall,
  parseDate,
  sanitizeDocFields,
} from "../lib/portal-docs.ts";

const today = new Date("2026-10-24T00:00:00Z");

test("parseDate: nhận ISO và dd/mm/yyyy, từ chối ngày không có thật", () => {
  assert.equal(parseDate("2005-05-12"), "2005-05-12");
  assert.equal(parseDate("12/05/2005"), "2005-05-12");
  assert.equal(parseDate("5-3-2026"), "2026-03-05");
  assert.equal(parseDate("30/02/2005"), null);
  assert.equal(parseDate("15 MARCH 2026"), null);
  assert.equal(parseDate("12/05/1850"), null);
  assert.equal(parseDate(20050512), null);
});

test("sanitizeDocFields: chỉ giữ trường thuộc loại giấy tờ, giá trị sai thành null", () => {
  const t = sanitizeDocFields("transcript", { full_name: " Nguyễn  Văn Test ", date_of_birth: "12/05/2005", gpa: "8,2", gpa_scale: 10, listening: 7 });
  assert.deepEqual([t.fullName, t.dateOfBirth, t.gpa, t.gpaScale, t.listening], ["Nguyễn Văn Test", "2005-05-12", 8.2, 10, null]);
  assert.equal(sanitizeDocFields("transcript", { gpa: 3.5, gpa_scale: 7 }).gpaScale, null, "thang lạ bị bỏ");
  assert.equal(sanitizeDocFields("transcript", { gpa: 3.5, gpa_scale: 4 }).gpaScale, 4);

  const i = sanitizeDocFields("ielts", { full_name: "A B", listening: 7, reading: 6.5, writing: "6.0", speaking: 6.5, overall: 6.5, test_date: "2026-03-15", gpa: 9 });
  assert.deepEqual([i.listening, i.reading, i.writing, i.speaking, i.overall, i.testDate, i.gpa], [7, 6.5, 6, 6.5, 6.5, "2026-03-15", null]);
  assert.equal(sanitizeDocFields("ielts", { listening: 6.75 }).listening, null, "band không phải bội của 0.5");
  assert.equal(sanitizeDocFields("ielts", { overall: 10 }).overall, null, "band ngoài 0-9");

  assert.equal(sanitizeDocFields("identity", { document_number: "012345678901" }).documentNumber, "012345678901");
  assert.equal(sanitizeDocFields("identity", { document_number: "12" }).documentNumber, null, "số quá ngắn");
  assert.equal(sanitizeDocFields("identity", { document_number: "B1234567" }).documentNumber, "B1234567");
  assert.equal(sanitizeDocFields("identity", { full_name: "unreadable" }).fullName, null, "chữ giữ chỗ coi như không đọc được");
  assert.deepEqual(sanitizeDocFields("ielts", null), E);
});

test("expectedIeltsOverall: trung bình 4 kỹ năng làm tròn 0.5", () => {
  assert.equal(expectedIeltsOverall(7, 6.5, 6, 6.5), 6.5);
  assert.equal(expectedIeltsOverall(6, 6, 6.5, 6.5), 6.5); // 6.25 -> 6.5
  assert.equal(expectedIeltsOverall(6, 6, 6, 6.5), 6.0); // 6.125 -> 6.0
  assert.equal(expectedIeltsOverall(7, 7, 6.5, 6.5), 7.0); // 6.75 -> 7.0
  assert.equal(expectedIeltsOverall(7, 7, 7, 6.5), 7.0); // 6.875 -> 7.0
  assert.equal(expectedIeltsOverall(9, 9, 9, 9), 9);
});

test("evaluateDocument: báo đúng trường thiếu và lý do", () => {
  const okT = { ...E, fullName: "A", dateOfBirth: "2005-05-12", gpa: 8.2, gpaScale: 10 };
  assert.equal(evaluateDocument("transcript", okT, today).status, "hop_le");

  const noGpa = evaluateDocument("transcript", { ...okT, gpa: null }, today);
  assert.equal(noGpa.status, "can_nop_lai");
  assert.ok(noGpa.problems[0].includes("điểm học tập tổng kết"));
  assert.ok(!noGpa.problems[0].includes("họ tên"), "không đổ lỗi cho trường đã đọc được");
  assert.deepEqual(noGpa.missingFields, ["gpa"]);

  const nothing = evaluateDocument("ielts", E, today);
  assert.match(nothing.problems[0], /mờ|không phải/);
  assert.ok(nothing.problems[0].includes("chứng chỉ IELTS"));

  assert.ok(evaluateDocument("transcript", { ...okT, gpa: 11 }, today).problems[0].includes("lớn hơn thang điểm"));
  assert.equal(evaluateDocument("identity", { ...E, fullName: "A", dateOfBirth: "2030-01-01", documentNumber: "012345678901" }, today).status, "can_nop_lai");

  const okI = { ...E, fullName: "A", listening: 7, reading: 6.5, writing: 6, speaking: 6.5, overall: 6.5, testDate: "2026-03-15" };
  assert.equal(evaluateDocument("ielts", okI, today).status, "hop_le");
  assert.ok(evaluateDocument("ielts", { ...okI, testDate: "2027-01-01" }, today).problems[0].includes("tương lai"));
  const bad = evaluateDocument("ielts", { ...okI, overall: 8 }, today);
  assert.equal(bad.status, "can_nop_lai");
  assert.ok(bad.problems[0].includes("6.5") && bad.problems[0].includes("8.0"), "nêu cả điểm đọc được lẫn điểm kỳ vọng");
});

test("evaluateProfile: thiếu / cần nộp lại / đủ", () => {
  const okT = { ...E, fullName: "A", dateOfBirth: "2005-05-12", gpa: 8.2, gpaScale: 10 };
  const okI = { ...E, fullName: "A", listening: 7, reading: 6.5, writing: 6, speaking: 6.5, overall: 6.5, testDate: "2026-03-15" };
  const okId = { ...E, fullName: "A", dateOfBirth: "2005-05-12", documentNumber: "012345678901" };

  const none = evaluateProfile({}, today);
  assert.equal(none.complete, false);
  assert.deepEqual(none.missing, ["transcript", "ielts", "identity"]);
  assert.ok(none.headline.includes("bảng điểm") && none.headline.includes("CMND"));

  const partial = evaluateProfile({ transcript: okT, ielts: null }, today);
  assert.deepEqual(partial.missing, ["ielts", "identity"]);
  assert.equal(partial.docs.transcript.status, "hop_le");

  const mixed = evaluateProfile({ transcript: okT, ielts: { ...okI, listening: null }, identity: okId }, today);
  assert.equal(mixed.complete, false);
  assert.deepEqual(mixed.invalid.map((x) => x.type), ["ielts"]);
  assert.ok(mixed.headline.includes("cần nộp lại chứng chỉ IELTS"));

  const full = evaluateProfile({ transcript: okT, ielts: okI, identity: okId }, today);
  assert.deepEqual([full.complete, full.missing, full.invalid], [true, [], []]);
});
