import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@supabase/server/core";
import { chatLimits, type StoredMessage } from "@/lib/chatbot-config";

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
