import { ExtractLeadButton } from "@/components/admin/extract-lead-button";
import { LeadQualityBadge } from "@/components/admin/lead-quality-badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import type { StoredLead } from "@/lib/lead-store";

function consultationLabel(value: boolean | null) {
  return value === true ? "Có" : value === false ? "Không" : "Chưa rõ";
}

function Field({ label, value, wide }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

/** Thông tin lead trích xuất từ cuộc trò chuyện. `latestMessageId`: id tin nhắn mới nhất, để báo lead đã cũ. */
export function LeadCard({
  conversationId,
  lead,
  latestMessageId,
  loadFailed,
  canWrite,
}: {
  conversationId: string;
  lead: StoredLead | null;
  latestMessageId: number | null;
  loadFailed?: boolean;
  /** Chỉ admin được trích xuất/trích xuất lại lead (ghi vào database); nhân viên chỉ xem. */
  canWrite: boolean;
}) {
  const stale =
    lead !== null &&
    latestMessageId !== null &&
    (lead.sourceMessageId === null || latestMessageId > lead.sourceMessageId);

  return (
    <Card className="mb-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-medium">Thông tin lead</h2>
          {lead && <LeadQualityBadge quality={lead.quality} />}
        </div>
        {canWrite && <ExtractLeadButton conversationId={conversationId} hasLead={lead !== null} />}
      </div>

      {loadFailed ? (
        <p className="mt-4 text-sm text-muted-foreground">Không tải được lead từ database. Thử tải lại trang.</p>
      ) : !lead ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Chưa trích xuất lead cho cuộc trò chuyện này. Bấm &quot;Trích xuất lead&quot; để Gemini đọc hội thoại và điền
          thông tin.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Field label="Tên" value={lead.name} />
            <Field label="Email" value={lead.email} />
            <Field label="Số điện thoại" value={lead.phone} />
            <Field label="Nước du học" value={lead.studyCountry} />
            <Field label="Bậc học" value={lead.educationLevel} />
            <Field label="Ngành" value={lead.major} />
            <Field label="Thời gian rảnh (availability)" value={lead.availability} />
            <Field label="Đặt lịch tư vấn" value={consultationLabel(lead.wantsConsultation)} />
            <Field label="Ghi chú" value={lead.note} wide />
            <Field label="Lý do đánh giá chất lượng" value={lead.qualityReason} wide />
          </dl>

          <p className="mt-4 text-xs text-muted-foreground">
            Trích xuất lúc {formatDateTime(lead.extractedAt)}
            {lead.model ? ` bằng ${lead.model}` : ""}
            {lead.sourceMessageCount !== null ? `, dựa trên ${lead.sourceMessageCount} tin nhắn` : ""}.
          </p>
          {stale && (
            <p className="mt-1 text-xs text-yellow-700">
              Cuộc trò chuyện có tin nhắn mới sau lần trích xuất này. Bấm &quot;Trích xuất lại&quot; để cập nhật.
            </p>
          )}
        </>
      )}
    </Card>
  );
}
