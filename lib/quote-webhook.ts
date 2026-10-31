import "server-only";

import {
  parseWebhookUrl,
  postQuoteWebhook,
  resolveLoginUrl,
  type QuoteApprovedWebhookPayload,
  type QuoteWebhookPayload,
  type WebhookResult,
} from "@/lib/quote";

// Gửi thông tin tới webhook Make.com. Chỉ chạy ở server.
// URL webhook để trong biến môi trường, không ghi vào code: ai có URL đều gửi được dữ liệu vào quy trình của Make.
// Log không in URL hay thông tin khách.

/** Yêu cầu báo giá MỚI (QUOTE_WEBHOOK_URL). Chưa đặt biến thì bỏ qua (chỉ ghi cảnh báo). */
export async function notifyQuoteWebhook(payload: QuoteWebhookPayload): Promise<void> {
  const raw = process.env.QUOTE_WEBHOOK_URL;
  const url = parseWebhookUrl(raw);
  if (!url) {
    console.warn(raw?.trim() ? "[quote-webhook] QUOTE_WEBHOOK_URL không hợp lệ (cần https), bỏ qua." : "[quote-webhook] Chưa đặt QUOTE_WEBHOOK_URL, bỏ qua.");
    return;
  }
  const result = await postQuoteWebhook(url, payload);
  if (!result.ok) console.error(`[quote-webhook] Gửi thất bại (${result.reason}), yêu cầu ${payload.id}.`);
}

/** Webhook "đã duyệt" (QUOTE_APPROVED_WEBHOOK_URL) đã cấu hình hợp lệ chưa. Kiểm tra TRƯỚC khi đổi trạng thái. */
export function approvedWebhookUrl(): string | null {
  return parseWebhookUrl(process.env.QUOTE_APPROVED_WEBHOOK_URL);
}

/** Gửi thông tin khách vừa được duyệt. Trả kết quả (không ném lỗi) để nơi gọi báo lại cho admin. */
export async function sendApprovedWebhook(payload: QuoteApprovedWebhookPayload): Promise<WebhookResult> {
  const url = approvedWebhookUrl();
  if (!url) return { ok: false, reason: "not_configured" };
  const result = await postQuoteWebhook(url, payload);
  if (!result.ok) console.error(`[quote-webhook] Gửi webhook duyệt thất bại (${result.reason}), yêu cầu ${payload.id}.`);
  return result;
}

/** Link đăng nhập gửi cho khách: QUOTE_LOGIN_URL nếu có, không thì /login trên NEXT_PUBLIC_SITE_URL (hoặc `fallbackOrigin`). */
export function loginUrlForCustomers(fallbackOrigin: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return resolveLoginUrl(process.env.QUOTE_LOGIN_URL, site || fallbackOrigin);
}
