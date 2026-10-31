import "server-only";

import { adminDb } from "@/lib/chat-store";
import { priceFor, type QuoteInput } from "@/lib/quote";

// Lưu yêu cầu báo giá vào bảng `quote_requests` (RIÊNG TƯ: RLS chặn trình duyệt, chỉ server bằng secret key).
// Giá luôn được tính lại ở đây từ gói dịch vụ, không nhận từ trình duyệt.

export interface SavedQuote {
  id: string;
  price: number;
  createdAt: string;
}

export class QuoteStorageError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Quote storage failed: ${operation}`, { cause });
    this.name = "QuoteStorageError";
  }
}

export async function createQuoteRequest(input: QuoteInput): Promise<SavedQuote> {
  const price = priceFor(input.servicePackage);
  const { data, error } = await adminDb()
    .from("quote_requests")
    .insert({
      customer_name: input.customerName,
      email: input.email,
      study_country: input.studyCountry,
      education_level: input.educationLevel,
      service_package: input.servicePackage,
      price,
    })
    .select("id, created_at")
    .single();
  if (error || !data) throw new QuoteStorageError("insert quote request", error);
  return { id: data.id as string, price, createdAt: data.created_at as string };
}

export interface StoredQuoteRequest {
  id: string;
  customerName: string;
  email: string;
  studyCountry: string;
  educationLevel: string;
  servicePackage: string;
  price: number;
  status: "cho_duyet" | "da_duyet" | "tu_choi";
  createdAt: string;
}

/** Yêu cầu báo giá mới nhất trước, dành cho admin. Gọi `requireAdmin()` ở nơi dùng. */
export async function listQuoteRequests(limit = 200): Promise<StoredQuoteRequest[]> {
  const { data, error } = await adminDb()
    .from("quote_requests")
    .select("id, customer_name, email, study_country, education_level, service_package, price, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new QuoteStorageError("list quote requests", error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    customerName: row.customer_name as string,
    email: row.email as string,
    studyCountry: row.study_country as string,
    educationLevel: row.education_level as string,
    servicePackage: row.service_package as string,
    price: Number(row.price),
    status: row.status as StoredQuoteRequest["status"],
    createdAt: row.created_at as string,
  }));
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isQuoteId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Chuyển yêu cầu từ "chờ duyệt" sang "đã duyệt" trong MỘT câu lệnh (điều kiện status nằm trong UPDATE) để bấm đúp hay hai admin
 * cùng bấm cũng chỉ một người thành công. Trả về null nếu yêu cầu không tồn tại hoặc không còn ở trạng thái chờ duyệt.
 */
export async function approveQuoteRequest(id: string): Promise<{ id: string; customerName: string; email: string } | null> {
  const { data, error } = await adminDb()
    .from("quote_requests")
    .update({ status: "da_duyet" })
    .eq("id", id)
    .eq("status", "cho_duyet")
    .select("id, customer_name, email")
    .maybeSingle();
  if (error) throw new QuoteStorageError("approve quote request", error);
  return data ? { id: data.id as string, customerName: data.customer_name as string, email: data.email as string } : null;
}

/** Hoàn tác việc duyệt (dùng khi gửi webhook thất bại) để admin có thể bấm Duyệt lại. */
export async function revertQuoteApproval(id: string): Promise<void> {
  const { error } = await adminDb().from("quote_requests").update({ status: "cho_duyet" }).eq("id", id).eq("status", "da_duyet");
  if (error) throw new QuoteStorageError("revert quote approval", error);
}

/**
 * Từ chối = xoá vĩnh viễn yêu cầu, nhưng chỉ khi nó vẫn đang "chờ duyệt" (điều kiện status nằm trong chính câu DELETE) để không
 * xoá nhầm yêu cầu vừa được người khác duyệt. Trả về false nếu không tồn tại hoặc không còn ở trạng thái chờ duyệt.
 */
export async function deletePendingQuoteRequest(id: string): Promise<boolean> {
  const { data, error } = await adminDb()
    .from("quote_requests")
    .delete()
    .eq("id", id)
    .eq("status", "cho_duyet")
    .select("id")
    .maybeSingle();
  if (error) throw new QuoteStorageError("delete pending quote request", error);
  return data !== null;
}
