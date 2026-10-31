// Test bảng giá và kiểm tra dữ liệu form báo giá (lib/quote.ts). Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { buildApprovedWebhookPayload, EMAIL_INVALID_MESSAGE, isValidEmail, parseLoginUrl, resolveLoginUrl, parseQuoteRequest, priceFor, QUOTE_PRICES } from "../lib/quote.ts";

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

// ---- Webhook ----
import http from "node:http";
import { buildQuoteWebhookPayload, parseWebhookUrl, postQuoteWebhook } from "../lib/quote.ts";

test("payload webhook chỉ gồm tên, email, gói, giá (+ id, giờ tạo)", () => {
  const input = { customerName: "An", email: "an@example.com", studyCountry: "Úc", educationLevel: "dai_hoc", servicePackage: "co_ban" };
  const p = buildQuoteWebhookPayload(input, { id: "id1", price: 15_000_000, createdAt: "2026-10-24T00:00:00Z" });
  assert.deepEqual(p, { event: "quote_request.created", id: "id1", customerName: "An", email: "an@example.com", servicePackage: "co_ban", servicePackageName: "Cơ bản", price: 15_000_000, createdAt: "2026-10-24T00:00:00Z" });
});

test("parseWebhookUrl: chỉ https (hoặc http localhost)", () => {
  assert.equal(parseWebhookUrl(undefined), null);
  assert.equal(parseWebhookUrl("  "), null);
  assert.equal(parseWebhookUrl("not a url"), null);
  assert.equal(parseWebhookUrl("http://hook.example.com/x"), null);
  assert.equal(parseWebhookUrl("ftp://hook.example.com/x"), null);
  assert.equal(parseWebhookUrl(" https://hook.example.com/abc "), "https://hook.example.com/abc");
  assert.equal(parseWebhookUrl("http://localhost:9999/x"), "http://localhost:9999/x");
});

test("postQuoteWebhook gửi đúng JSON, báo lỗi khi bên nhận lỗi/không có/quá chậm, không ném lỗi", async () => {
  const seen = [];
  let mode = "ok";
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ method: req.method, type: req.headers["content-type"], body });
      if (mode === "slow") return; // không trả lời
      res.statusCode = mode === "fail" ? 500 : 200;
      res.end("Accepted");
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}/hook`;
  const payload = { event: "quote_request.created", id: "i", customerName: "Trần Thị Mai", email: "m@example.com", servicePackage: "toan_dien", servicePackageName: "Toàn diện", price: 30_000_000, createdAt: "t" };
  try {
    assert.deepEqual(await postQuoteWebhook(url, payload), { ok: true });
    assert.equal(seen[0].method, "POST");
    assert.equal(seen[0].type, "application/json");
    assert.deepEqual(JSON.parse(seen[0].body), payload);

    mode = "fail";
    assert.deepEqual(await postQuoteWebhook(url, payload), { ok: false, reason: "HTTP 500" });

    mode = "slow";
    assert.equal((await postQuoteWebhook(url, payload, 200)).ok, false, "quá thời gian chờ thì báo lỗi");
  } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
  assert.equal((await postQuoteWebhook("http://127.0.0.1:1/none", payload, 500)).ok, false, "không kết nối được thì báo lỗi, không ném");
});

test("isValidEmail: nhận email đúng định dạng", () => {
  for (const ok of ["a@example.com", "ten.ho+tag@sub.example.co.uk", " a@b.vn ", "a_b-c@my-site.io", "x@a.com"]) {
    assert.equal(isValidEmail(ok), true, ok);
  }
});

test("isValidEmail: từ chối email sai định dạng", () => {
  const bad = [
    "", "   ", "khong-phai-email", "a@b", "a@b.c", "@example.com", "a@", "a@@b.com", "a b@example.com",
    "a@b..com", "a@.com", "a@b.com.", ".a@b.com", "a.@b.com", "a..b@b.com", "a@-b.com", "a@b-.com",
    "a@b.123", "a@exa mple.com", "a@b.com,c@d.com", "<a@b.com>", "tên@gmail.com",
    "a".repeat(65) + "@example.com", "a@" + "b".repeat(64) + ".com",
  ];
  for (const email of bad) assert.equal(isValidEmail(email), false, JSON.stringify(email));
  assert.equal(isValidEmail("a@" + "b".repeat(320) + ".com"), false, "quá dài");
});

test("server cũng từ chối email sai bằng cùng thông điệp", () => {
  const r = parseQuoteRequest({ ...good, email: "a@b..com" }, countries);
  assert.deepEqual([r.ok, r.message], [false, EMAIL_INVALID_MESSAGE]);
  assert.equal(parseQuoteRequest({ ...good, email: "" }, countries).message, "Vui lòng nhập email.");
});

test("payload duyệt gồm đúng tên, email, link đăng nhập (kèm id, event)", () => {
  const p = buildApprovedWebhookPayload({ id: "id1", customerName: "An", email: "an@example.com", extra: "bỏ qua" }, "https://site.example/login");
  assert.deepEqual(p, { event: "quote_request.approved", id: "id1", customerName: "An", email: "an@example.com", loginUrl: "https://site.example/login" });
});

test("link đăng nhập: ưu tiên giá trị cấu hình, không có thì /login của website", () => {
  assert.equal(resolveLoginUrl(undefined, "https://site.example"), "https://site.example/login");
  assert.equal(resolveLoginUrl("  ", "https://site.example/"), "https://site.example/login");
  assert.equal(resolveLoginUrl("https://app.example.com/dang-nhap?x=1", "https://site.example"), "https://app.example.com/dang-nhap?x=1");
  assert.equal(resolveLoginUrl("javascript:alert(1)", "https://site.example"), "https://site.example/login", "giá trị sai thì dùng mặc định");
  assert.equal(resolveLoginUrl("https://user:pw@evil.example/", "https://site.example"), "https://site.example/login");
  assert.equal(resolveLoginUrl(undefined, "http://localhost:3000"), "http://localhost:3000/login");
});

test("parseLoginUrl: chỉ http(s) không kèm tài khoản", () => {
  assert.equal(parseLoginUrl(undefined), null);
  assert.equal(parseLoginUrl("không phải url"), null);
  assert.equal(parseLoginUrl("ftp://a.example/x"), null);
  assert.equal(parseLoginUrl("data:text/html,x"), null);
  assert.equal(parseLoginUrl("https://a.example/login"), "https://a.example/login");
});
