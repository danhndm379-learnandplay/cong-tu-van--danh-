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
