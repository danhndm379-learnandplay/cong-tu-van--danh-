import "server-only";

import { createAdminClient, createContextClient as createAnonClient } from "@supabase/server/core";

let warned = false;

/**
 * Client Supabase để đọc dữ liệu CÔNG KHAI (bảng `schools`, `scholarships`), chạy trên server.
 * Ưu tiên client ẩn danh (publishable key, vai trò `anon`, RLS áp dụng): chỉ cần quyền tối thiểu.
 * Nếu môi trường thiếu SUPABASE_PUBLISHABLE_KEY (ví dụ quên đặt trên Vercel) thì tạm dùng secret key phía server để
 * trang công khai không bị hỏng; chỉ dùng cho truy vấn đọc cố định các bảng công khai, và có cảnh báo trong log.
 * Dữ liệu riêng tư (hội thoại, lead, hồ sơ học viên) luôn đi qua lib/chat-store.ts (`adminDb`).
 */
export function createContextClient() {
  try {
    return createAnonClient();
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(
        "[supabase-public] Thiếu SUPABASE_PUBLISHABLE_KEY nên đọc dữ liệu công khai bằng secret key phía server. Nên đặt biến này để dùng quyền tối thiểu.",
        err instanceof Error ? err.message : err,
      );
    }
    return createAdminClient();
  }
}
