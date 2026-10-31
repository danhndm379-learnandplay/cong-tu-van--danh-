import "server-only";

import { adminDb, StorageError } from "@/lib/chat-store";
import type { Lead, LeadQuality } from "@/lib/lead-sanitize";
import { createAuthClient } from "@/lib/supabase-auth";

// Lưu lead vào bảng `leads` (RIÊNG TƯ, có PII; chỉ service_role truy cập được — xem migration create_leads_table).
// Như chat-store: các hàm ĐỌC dùng secret key và không tự kiểm tra quyền (nơi gọi phải qua `requireStaff()` / `checkStaffRead()`);
// hàm GHI (`saveLead`) chạy bằng phiên của người dùng nên RLS chỉ cho admin ghi (nơi gọi vẫn kiểm tra `checkAdminWrite()` trước).

export interface StoredLead extends Lead {
  id: string;
  conversationId: string;
  /** id tin nhắn cuối cùng được đọc lúc trích xuất; so với tin nhắn mới nhất để biết lead có cũ không. */
  sourceMessageId: number | null;
  sourceMessageCount: number | null;
  model: string | null;
  extractedAt: string;
}

interface LeadRow {
  id: string;
  conversation_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  study_country: string | null;
  education_level: string | null;
  major: string | null;
  availability: string | null;
  wants_consultation: boolean | null;
  note: string | null;
  quality: LeadQuality;
  quality_reason: string | null;
  source_message_id: number | null;
  source_message_count: number | null;
  model: string | null;
  extracted_at: string;
}

const LEAD_COLUMNS =
  "id, conversation_id, name, email, phone, study_country, education_level, major, availability, wants_consultation, note, quality, quality_reason, source_message_id, source_message_count, model, extracted_at";

function toStoredLead(row: LeadRow): StoredLead {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    studyCountry: row.study_country,
    educationLevel: row.education_level,
    major: row.major,
    availability: row.availability,
    wantsConsultation: row.wants_consultation,
    note: row.note,
    quality: row.quality,
    qualityReason: row.quality_reason,
    sourceMessageId: row.source_message_id,
    sourceMessageCount: row.source_message_count,
    model: row.model,
    extractedAt: row.extracted_at,
  };
}

export async function getLeadForAdmin(conversationId: string): Promise<StoredLead | null> {
  const { data, error } = await adminDb()
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (error) throw new StorageError("get lead", error);
  return data ? toStoredLead(data as LeadRow) : null;
}

/** Tạo hoặc ghi đè lead của cuộc trò chuyện (mỗi cuộc có tối đa một lead). Chạy bằng phiên người dùng: RLS chỉ cho admin ghi. */
export async function saveLead(
  conversationId: string,
  lead: Lead,
  source: { messageId: number | null; messageCount: number; model: string },
): Promise<StoredLead> {
  const { data, error } = await (await createAuthClient())
    .from("leads")
    .upsert(
      {
        conversation_id: conversationId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        study_country: lead.studyCountry,
        education_level: lead.educationLevel,
        major: lead.major,
        availability: lead.availability,
        wants_consultation: lead.wantsConsultation,
        note: lead.note,
        quality: lead.quality,
        quality_reason: lead.qualityReason,
        source_message_id: source.messageId,
        source_message_count: source.messageCount,
        model: source.model,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "conversation_id" },
    )
    .select(LEAD_COLUMNS)
    .single();
  if (error) throw new StorageError("save lead", error);
  return toStoredLead(data as LeadRow);
}

export interface LeadExportRow extends StoredLead {
  conversationStartedAt: string;
  conversationLastMessageAt: string;
}

const EXPORT_MAX_ROWS = 5000;

/** Toàn bộ lead đã trích xuất (mới nhất trước) kèm thời điểm cuộc trò chuyện, để xuất CSV. `quality` null = mọi mức. */
export async function listLeadsForExport(quality: LeadQuality | null): Promise<LeadExportRow[]> {
  let query = adminDb()
    .from("leads")
    .select(`${LEAD_COLUMNS}, conversations(created_at, last_message_at)`)
    .order("extracted_at", { ascending: false })
    .limit(EXPORT_MAX_ROWS);
  if (quality) query = query.eq("quality", quality);

  const { data, error } = await query;
  if (error) throw new StorageError("list leads for export", error);

  return ((data ?? []) as unknown as (LeadRow & {
    conversations: { created_at: string; last_message_at: string } | { created_at: string; last_message_at: string }[] | null;
  })[]).map((row) => {
    const conversation = Array.isArray(row.conversations) ? row.conversations[0] : row.conversations;
    return {
      ...toStoredLead(row),
      conversationStartedAt: conversation?.created_at ?? "",
      conversationLastMessageAt: conversation?.last_message_at ?? "",
    };
  });
}
