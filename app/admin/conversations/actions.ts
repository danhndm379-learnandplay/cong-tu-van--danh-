"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { checkAdminWrite } from "@/lib/admin-guard";
import { deleteConversationForAdmin, getConversationForAdmin } from "@/lib/chat-store";
import { extractLead, LeadExtractionError, type LeadExtractionErrorCode } from "@/lib/lead-extraction";
import { saveLead } from "@/lib/lead-store";
import { checkRateLimit } from "@/lib/rate-limit";

export type DeleteResult = { ok: true } | { ok: false; error: string };
export type ExtractLeadResult = { ok: true } | { ok: false; error: string };

/** Xoá vĩnh viễn một cuộc trò chuyện và toàn bộ tin nhắn (cùng lead) của nó. Chỉ chạy khi qua đăng nhập admin (nếu đã bật). */
export async function deleteConversationAction(id: string): Promise<DeleteResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (typeof id !== "string") return { ok: false, error: "Id cuộc trò chuyện không hợp lệ." };

  try {
    const deleted = await deleteConversationForAdmin(id);
    if (!deleted) return { ok: false, error: "Không tìm thấy cuộc trò chuyện (có thể đã bị xoá)." };
  } catch (err) {
    console.error("[admin/conversations] Xoá thất bại:", err);
    return { ok: false, error: "Không xoá được do lỗi database, thử lại sau." };
  }

  console.info(`[admin/conversations] Đã xoá cuộc trò chuyện ${id}`);
  revalidatePath("/admin/conversations");
  return { ok: true };
}

const LEAD_ERROR_MESSAGES: Record<LeadExtractionErrorCode, string> = {
  not_configured: "Chưa cấu hình GEMINI_API_KEY nên không trích xuất được.",
  no_user_messages: "Cuộc trò chuyện chưa có tin nhắn nào của khách để trích xuất.",
  upstream_busy: "Gemini đang bận hoặc hết hạn mức, thử lại sau ít phút.",
  upstream_error: "Gemini gặp lỗi khi trích xuất, thử lại sau.",
  invalid_output: "Gemini trả về dữ liệu không đọc được, thử trích xuất lại.",
};

// Mỗi lần trích xuất tốn một lượt gọi Gemini nên giới hạn tần suất (theo IP và toàn site), tách riêng với chatbot.
const EXTRACT_LIMIT_PER_IP = 6;
const EXTRACT_LIMIT_GLOBAL = 10;

/** Trích xuất lead của một cuộc trò chuyện bằng Gemini rồi lưu (ghi đè) vào bảng `leads`. */
export async function extractLeadAction(conversationId: string): Promise<ExtractLeadResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (typeof conversationId !== "string") return { ok: false, error: "Id cuộc trò chuyện không hợp lệ." };

  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const perIp = checkRateLimit(`lead-ip:${forwarded}`, EXTRACT_LIMIT_PER_IP);
  const global = perIp.ok ? checkRateLimit("lead-global", EXTRACT_LIMIT_GLOBAL) : perIp;
  if (!global.ok) {
    return { ok: false, error: `Bạn thao tác hơi nhanh, thử lại sau ${global.retryAfterSec} giây.` };
  }

  try {
    const conversation = await getConversationForAdmin(conversationId);
    if (!conversation) return { ok: false, error: "Không tìm thấy cuộc trò chuyện." };

    const { lead, model } = await extractLead(conversation.messages);
    await saveLead(conversation.id, lead, {
      messageId: conversation.messages.at(-1)?.id ?? null,
      messageCount: conversation.messages.length,
      model,
    });
  } catch (err) {
    if (err instanceof LeadExtractionError) return { ok: false, error: LEAD_ERROR_MESSAGES[err.code] };
    console.error("[admin/conversations] Trích xuất lead thất bại:", err);
    return { ok: false, error: "Không lưu được lead do lỗi database, thử lại sau." };
  }

  revalidatePath(`/admin/conversations/${conversationId}`);
  return { ok: true };
}
