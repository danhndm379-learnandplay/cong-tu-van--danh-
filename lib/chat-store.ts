import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@supabase/server/core";
import { chatLimits, type StoredMessage } from "@/lib/chatbot-config";
import type { LeadQuality, LeadQualityFilter } from "@/lib/lead-sanitize";
import { createAuthClient } from "@/lib/supabase-auth";

// Lưu lịch sử chat vào Supabase. Hai bảng `conversations` và `messages` là dữ liệu riêng tư:
// RLS bật, anon/authenticated không có quyền gì, chỉ secret key (service_role) trên server truy cập được.
// File này dùng `createAdminClient` (bỏ qua RLS) nên TUYỆT ĐỐI không import vào code chạy ở trình duyệt
// (`server-only` ở trên sẽ báo lỗi build nếu lỡ import).
//
// Khách được nhận diện bằng token ngẫu nhiên trong cookie httpOnly; database chỉ lưu sha256 của token.

export const VISITOR_COOKIE = "duhoc24_visitor";
export const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class StorageError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Chat storage failed: ${operation}`, { cause });
    this.name = "StorageError";
  }
}

export function newVisitorToken() {
  return randomBytes(32).toString("base64url");
}

export function isValidVisitorToken(token: string | undefined): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

export function hashVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function db() {
  try {
    return createAdminClient();
  } catch (err) {
    throw new StorageError("create client (thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY?)", err);
  }
}

/** Client admin (bỏ qua RLS) dùng chung cho các module lưu trữ phía server khác (vd. lead-store). */
export { db as adminDb };

interface MessageRow {
  id: number;
  role: "user" | "bot";
  content: string;
  created_at: string;
}

function toStoredMessage(row: MessageRow): StoredMessage {
  return { id: row.id, from: row.role, text: row.content, createdAt: row.created_at };
}

/** Cuộc trò chuyện gần nhất của khách, hoặc null nếu chưa có. */
export async function findLatestConversationId(visitorHash: string): Promise<string | null> {
  const { data, error } = await db()
    .from("conversations")
    .select("id")
    .eq("visitor_token_hash", visitorHash)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new StorageError("find conversation", error);
  return data?.id ?? null;
}

async function createConversation(visitorHash: string): Promise<string> {
  const { data, error } = await db()
    .from("conversations")
    .insert({ visitor_token_hash: visitorHash })
    .select("id")
    .single();
  if (error) throw new StorageError("create conversation", error);
  return data.id;
}

/** `limit` tin nhắn mới nhất của cuộc trò chuyện, xếp từ cũ đến mới. */
export async function listMessages(
  conversationId: string,
  limit: number = chatLimits.maxDisplayMessages,
): Promise<StoredMessage[]> {
  const { data, error } = await db()
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new StorageError("list messages", error);
  return (data as MessageRow[]).reverse().map(toStoredMessage);
}

/**
 * Lưu một lượt hỏi–đáp (câu của khách + câu trả lời của bot) vào cuộc trò chuyện gần nhất,
 * tạo cuộc trò chuyện mới nếu khách chưa có. Trả về hai tin nhắn đã lưu, đọc lại từ database.
 */
export async function appendTurn(
  visitorHash: string,
  conversationId: string | null,
  userText: string,
  botText: string,
): Promise<StoredMessage[]> {
  const id = conversationId ?? (await createConversation(visitorHash));
  const { data, error } = await db()
    .from("messages")
    .insert([
      { conversation_id: id, role: "user", content: userText },
      { conversation_id: id, role: "bot", content: botText },
    ])
    .select("id, role, content, created_at");
  if (error) throw new StorageError("append messages", error);
  return (data as MessageRow[]).sort((a, b) => a.id - b.id).map(toStoredMessage);
}

// ---- Dành cho trang admin (xem hội thoại thật của khách) ----
// Các hàm dưới đây KHÔNG tự kiểm tra quyền: nơi gọi phải gọi `requireStaff()` (lib/admin-guard.ts) trước.

export const ADMIN_PAGE_SIZE = 20;
const ADMIN_MAX_MESSAGES = 2000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminConversationSummary {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
  firstUserMessage: string | null;
  /** Chất lượng lead đã trích xuất; null nếu cuộc trò chuyện chưa trích xuất lead. */
  leadQuality: LeadQuality | null;
}

export interface AdminConversationDetail {
  id: string;
  createdAt: string;
  lastMessageAt: string;
  messages: StoredMessage[];
  /** true nếu cuộc trò chuyện dài hơn giới hạn hiển thị và đã bị cắt bớt. */
  truncated: boolean;
}

interface SummaryRow {
  id: string;
  created_at: string;
  last_message_at: string;
  message_count: number | string;
  first_user_message: string | null;
  lead_quality: LeadQuality | null;
}

/**
 * Danh sách hội thoại (mới nhất trước), có phân trang. `quality`: lọc theo chất lượng lead
 * ("good" | "ok" | "spam") hoặc "none" = chưa trích xuất lead; bỏ trống = tất cả.
 */
export async function listConversationsForAdmin(
  page: number,
  quality: LeadQualityFilter | null = null,
): Promise<{ items: AdminConversationSummary[]; total: number }> {
  const client = db();
  const offset = (Math.max(1, page) - 1) * ADMIN_PAGE_SIZE;

  const [{ data, error }, { data: total, error: countError }] = await Promise.all([
    client.rpc("list_conversations_for_admin", {
      p_limit: ADMIN_PAGE_SIZE,
      p_offset: offset,
      p_quality: quality,
    }),
    client.rpc("count_conversations_for_admin", { p_quality: quality }),
  ]);
  if (error) throw new StorageError("list conversations", error);
  if (countError) throw new StorageError("count conversations", countError);

  const items = ((data ?? []) as SummaryRow[]).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    messageCount: Number(row.message_count),
    firstUserMessage: row.first_user_message,
    leadQuality: row.lead_quality,
  }));
  return { items, total: Number(total ?? 0) };
}

/** Một cuộc trò chuyện kèm toàn bộ tin nhắn (cũ → mới); null nếu id không hợp lệ hoặc không tồn tại. */
export async function getConversationForAdmin(id: string): Promise<AdminConversationDetail | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const client = db();

  const { data: conversation, error } = await client
    .from("conversations")
    .select("id, created_at, last_message_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new StorageError("get conversation", error);
  if (!conversation) return null;

  const { data: rows, error: messagesError } = await client
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("id", { ascending: true })
    .limit(ADMIN_MAX_MESSAGES + 1);
  if (messagesError) throw new StorageError("get conversation messages", messagesError);

  const all = (rows ?? []) as MessageRow[];
  return {
    id: conversation.id,
    createdAt: conversation.created_at,
    lastMessageAt: conversation.last_message_at,
    messages: all.slice(0, ADMIN_MAX_MESSAGES).map(toStoredMessage),
    truncated: all.length > ADMIN_MAX_MESSAGES,
  };
}

/**
 * Xoá VĨNH VIỄN một cuộc trò chuyện cùng toàn bộ tin nhắn (tin nhắn bị xoá theo qua `on delete cascade`).
 * Trả về false nếu id không hợp lệ, không tồn tại HOẶC người gọi không phải admin (RLS từ chối: không xoá hàng nào).
 * Chạy bằng PHIÊN CỦA NGƯỜI DÙNG (không phải secret key) để RLS ở database quyết định theo vai trò; nơi gọi vẫn kiểm tra
 * `checkAdminWrite()` trước để báo lỗi rõ ràng.
 */
export async function deleteConversationForAdmin(id: string): Promise<boolean> {
  if (!UUID_PATTERN.test(id)) return false;
  const { data, error } = await (await createAuthClient()).from("conversations").delete().eq("id", id).select("id");
  if (error) throw new StorageError("delete conversation", error);
  return (data?.length ?? 0) > 0;
}
