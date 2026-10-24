// Test kiểm chứng kết quả trích xuất lead của Gemini (lib/lead-sanitize.ts). Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { parseQualityFilter, sanitizeLead } from "../lib/lead-sanitize.ts";

const user = ["Mình tên An, email An.Test@Example.com, sđt 090 123 4567", "muốn học thạc sĩ ở Úc"];

test("giữ email/sđt có thật trong lời khách và chuẩn hoá", () => {
  const good = sanitizeLead({ name: " An  ", email: "an.test@example.com", phone: "090 123 4567", quality: "good", wants_consultation: true, study_country: "Úc" }, user);
  assert.deepEqual([good.name, good.email, good.phone, good.quality, good.studyCountry, good.wantsConsultation], ["An", "an.test@example.com", "090 123 4567", "good", "Úc", true]);
});

test("không tin model: email bịa, hotline của chatbot, sđt quá ngắn đều bị bỏ", () => {
  assert.equal(sanitizeLead({ email: "bia@dat.com" }, user).email, null);
  assert.equal(sanitizeLead({ phone: "0912 345 6789" }, user).phone, null);
  assert.equal(sanitizeLead({ phone: "+84 90 123 4567" }, user).phone, "+84 90 123 4567", "đầu số +84 khớp 0xx");
  assert.equal(sanitizeLead({ phone: "123" }, ["123"]).phone, null);
  assert.equal(sanitizeLead({ email: "not-an-email" }, ["not-an-email"]).email, null);
});

test("'good' bắt buộc có thông tin liên hệ hợp lệ", () => {
  const r = sanitizeLead({ quality: "good", quality_reason: "Quan tâm rõ" }, ["xin chào"]);
  assert.equal(r.quality, "ok");
  assert.ok(r.qualityReason.includes("Hạ xuống"));
  assert.equal(sanitizeLead({ quality: "spam" }, []).quality, "spam");
  assert.equal(sanitizeLead({ quality: "excellent" }, []).quality, "ok");
});

test("chữ giữ chỗ, kiểu dữ liệu sai, chuỗi quá dài", () => {
  assert.equal(sanitizeLead({ name: "N/A" }, []).name, null);
  assert.equal(sanitizeLead({ note: "null" }, []).note, null);
  assert.equal(sanitizeLead({ wants_consultation: "yes" }, []).wantsConsultation, null);
  assert.equal(sanitizeLead(null, []).quality, "ok");
  assert.equal(sanitizeLead({ note: "x".repeat(5000) }, []).note.length, 2000);
  assert.equal(sanitizeLead({ major: "Công   nghệ\n thông tin" }, []).major, "Công nghệ thông tin");
});

test("parseQualityFilter: chỉ nhận giá trị hợp lệ", () => {
  assert.equal(parseQualityFilter("good"), "good");
  assert.equal(parseQualityFilter("none"), "none");
  assert.equal(parseQualityFilter(["spam", "ok"]), "spam");
  assert.equal(parseQualityFilter("bogus"), null);
  assert.equal(parseQualityFilter(undefined), null);
});
