// Test bảng giá và kiểm tra dữ liệu form báo giá (lib/quote.ts). Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { parseQuoteRequest, priceFor, QUOTE_PRICES } from "../lib/quote.ts";

const countries = ["Mỹ", "Anh", "Úc"];
const good = { customerName: "  Nguyễn   Văn A ", email: " a@example.com ", studyCountry: "Úc", educationLevel: "dai_hoc", servicePackage: "toan_dien" };

test("bảng giá theo gói", () => {
  assert.equal(priceFor("co_ban"), 15_000_000);
  assert.equal(priceFor("toan_dien"), 30_000_000);
  assert.deepEqual(Object.keys(QUOTE_PRICES).sort(), ["co_ban", "toan_dien"]);
});

test("dữ liệu hợp lệ được chuẩn hoá và bỏ qua trường thừa (kể cả giá do trình duyệt gửi)", () => {
  const r = parseQuoteRequest({ ...good, price: 1, status: "da_duyet" }, countries);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { customerName: "Nguyễn Văn A", email: "a@example.com", studyCountry: "Úc", educationLevel: "dai_hoc", servicePackage: "toan_dien" });
  assert.equal("price" in r.value, false);
  assert.equal("status" in r.value, false);
});

test("từ chối dữ liệu thiếu hoặc sai", () => {
  const bad = (patch) => parseQuoteRequest({ ...good, ...patch }, countries);
  assert.equal(bad({ customerName: "   " }).ok, false);
  assert.equal(bad({ customerName: "x".repeat(201) }).ok, false);
  assert.equal(bad({ customerName: "A\u0000B" }).ok, false);
  assert.equal(bad({ email: "khong-phai-email" }).ok, false);
  assert.equal(bad({ email: "a@b" }).ok, false);
  assert.equal(bad({ email: "a b@example.com" }).ok, false);
  assert.equal(bad({ studyCountry: "" }).ok, false);
  assert.equal(bad({ studyCountry: "Narnia" }).ok, false);
  assert.equal(bad({ educationLevel: "tien_si" }).ok, false);
  assert.equal(bad({ servicePackage: "vip" }).ok, false);
  assert.equal(bad({ servicePackage: "toString" }).ok, false, "không nhận tên thuộc tính của Object");
  assert.equal(bad({ customerName: 123 }).ok, false);
  assert.equal(parseQuoteRequest(null, countries).ok, false);
  assert.equal(parseQuoteRequest("chuỗi", countries).ok, false);
});
