import { after } from "next/server";
import { clientIp } from "@/lib/client-ip";
import { countries } from "@/lib/mock-data";
import { buildQuoteWebhookPayload, parseQuoteRequest } from "@/lib/quote";
import { notifyQuoteWebhook } from "@/lib/quote-webhook";
import { createQuoteRequest } from "@/lib/quote-store";
import { checkRateLimit } from "@/lib/rate-limit";

// Nhận yêu cầu báo giá từ form ở trang chủ: kiểm tra dữ liệu, tính giá theo gói ở server, lưu vào Supabase rồi trả giá cho khách.
const NO_STORE = { "Cache-Control": "no-store" };
const LIMIT_PER_IP = 5;
const LIMIT_GLOBAL = 30;
const MAX_BODY_BYTES = 10_000;

function fail(error: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json({ ok: false, error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  const perIp = checkRateLimit(`quote-ip:${clientIp(request)}`, LIMIT_PER_IP);
  const limited = perIp.ok ? checkRateLimit("quote-global", LIMIT_GLOBAL) : perIp;
  if (!limited.ok) {
    return fail("rate_limited", `Bạn thao tác hơi nhanh, vui lòng đợi ${limited.retryAfterSec} giây rồi thử lại.`, 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail("invalid", "Dữ liệu gửi lên quá lớn.", 413);
    raw = JSON.parse(text);
  } catch {
    return fail("invalid", "Dữ liệu gửi lên không hợp lệ.", 400);
  }

  const parsed = parseQuoteRequest(raw, countries);
  if (!parsed.ok) return fail("invalid", parsed.message, 400);

  try {
    const saved = await createQuoteRequest(parsed.value);
    // Báo cho Make.com sau khi đã trả lời khách; yêu cầu đã lưu rồi nên webhook lỗi cũng không làm hỏng yêu cầu.
    after(() => notifyQuoteWebhook(buildQuoteWebhookPayload(parsed.value, saved)));
    return Response.json({ ok: true, price: saved.price, servicePackage: parsed.value.servicePackage }, { headers: NO_STORE });
  } catch (err) {
    console.error("[api/quotes] Lỗi:", err);
    return fail("internal", "Chưa lưu được yêu cầu báo giá do lỗi hệ thống, bạn thử lại sau ít phút.", 500);
  }
}
