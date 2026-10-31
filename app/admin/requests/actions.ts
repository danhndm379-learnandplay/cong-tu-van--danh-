"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkAdminWrite } from "@/lib/admin-guard";
import { clientIp } from "@/lib/client-ip";
import { buildApprovedWebhookPayload } from "@/lib/quote";
import { approveQuoteRequest, deletePendingQuoteRequest, isQuoteId, revertQuoteApproval } from "@/lib/quote-store";
import { approvedWebhookUrl, loginUrlForCustomers, sendApprovedWebhook } from "@/lib/quote-webhook";
import { checkRateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/site-url";

export type ApproveResult = { ok: true; email: string } | { ok: false; error: string };
export type RejectResult = { ok: true } | { ok: false; error: string };

const APPROVE_LIMIT_PER_IP = 20;
const REJECT_LIMIT_PER_IP = 30;

async function ipOfCaller(): Promise<string> {
  return clientIp(new Request("http://x", { headers: await headers() }));
}

/**
 * Admin bấm Duyệt: đổi trạng thái sang "đã duyệt" rồi gửi tên, email và link đăng nhập của khách tới webhook Make.com.
 * Server Action là endpoint công khai nên tự kiểm tra quyền admin ở đây.
 * Gửi webhook thất bại thì hoàn tác việc duyệt để admin bấm lại được (không để khách "đã duyệt" mà không nhận được link).
 */
export async function approveQuoteAction(id: string): Promise<ApproveResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (!isQuoteId(id)) return { ok: false, error: "Id yêu cầu không hợp lệ." };

  const limited = checkRateLimit(`approve-ip:${await ipOfCaller()}`, APPROVE_LIMIT_PER_IP);
  if (!limited.ok) return { ok: false, error: `Bạn thao tác hơi nhanh, thử lại sau ${limited.retryAfterSec} giây.` };

  // Kiểm tra cấu hình TRƯỚC khi đổi trạng thái: thiếu thì không làm gì cả.
  if (!approvedWebhookUrl()) {
    return { ok: false, error: "Chưa cấu hình QUOTE_APPROVED_WEBHOOK_URL (cần https) nên chưa gửi được link cho khách. Yêu cầu vẫn ở trạng thái chờ duyệt." };
  }

  let claimed;
  try {
    claimed = await approveQuoteRequest(id);
  } catch (err) {
    console.error("[admin/requests] Duyệt thất bại:", err);
    return { ok: false, error: "Không cập nhật được trạng thái do lỗi database, thử lại sau." };
  }
  if (!claimed) return { ok: false, error: "Yêu cầu này đã được duyệt hoặc không còn tồn tại. Hãy tải lại trang." };

  const sent = await sendApprovedWebhook(buildApprovedWebhookPayload(claimed, loginUrlForCustomers(await requestOrigin())));
  if (!sent.ok) {
    try {
      await revertQuoteApproval(claimed.id);
    } catch (err) {
      console.error("[admin/requests] Hoàn tác duyệt thất bại:", err);
    }
    revalidatePath("/admin/requests");
    return { ok: false, error: "Chưa gửi được thông tin tới Make nên chưa duyệt. Yêu cầu vẫn ở trạng thái chờ duyệt, bạn thử lại sau ít phút." };
  }

  console.info(`[admin/requests] Đã duyệt yêu cầu ${claimed.id} và gửi webhook`);
  revalidatePath("/admin/requests");
  return { ok: true, email: claimed.email };
}

/**
 * Admin bấm Từ chối: XOÁ VĨNH VIỄN yêu cầu (chỉ khi còn "chờ duyệt"). Không gửi gì sang Make hay cho khách.
 * Tự kiểm tra quyền admin như mọi Server Action.
 */
export async function rejectQuoteAction(id: string): Promise<RejectResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (!isQuoteId(id)) return { ok: false, error: "Id yêu cầu không hợp lệ." };

  const limited = checkRateLimit(`reject-ip:${await ipOfCaller()}`, REJECT_LIMIT_PER_IP);
  if (!limited.ok) return { ok: false, error: `Bạn thao tác hơi nhanh, thử lại sau ${limited.retryAfterSec} giây.` };

  try {
    const deleted = await deletePendingQuoteRequest(id);
    if (!deleted) return { ok: false, error: "Yêu cầu này đã được duyệt, đã bị xoá hoặc không còn tồn tại. Hãy tải lại trang." };
  } catch (err) {
    console.error("[admin/requests] Từ chối (xoá) thất bại:", err);
    return { ok: false, error: "Không xoá được do lỗi database, thử lại sau." };
  }

  console.info(`[admin/requests] Đã từ chối và xoá yêu cầu ${id}`);
  revalidatePath("/admin/requests");
  return { ok: true };
}
