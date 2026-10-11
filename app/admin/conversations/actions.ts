"use server";

import { revalidatePath } from "next/cache";
import { checkAdminWrite } from "@/lib/admin-guard";
import { deleteConversationForAdmin } from "@/lib/chat-store";

export type DeleteResult = { ok: true } | { ok: false; error: string };

/** Xoá vĩnh viễn một cuộc trò chuyện và toàn bộ tin nhắn của nó. Chỉ chạy khi đã bật và qua đăng nhập admin. */
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
