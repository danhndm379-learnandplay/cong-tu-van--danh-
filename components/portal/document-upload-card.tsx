"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { FileText, IdCard, Medal, Upload } from "lucide-react";
import { DocStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DocStatus as BadgeStatus } from "@/lib/mock-data";
import { DOC_LABELS, RESUBMIT_TIPS, type DocStatus, type DocType } from "@/lib/portal-docs";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-validation";

const ICONS = { transcript: FileText, ielts: Medal, identity: IdCard } as const;

const ACCEPT: Record<DocType, { attr: string; hint: string }> = {
  transcript: { attr: "application/pdf", hint: "Chấp nhận file PDF, tối đa 4 MB" },
  ielts: { attr: "image/jpeg,image/png,image/webp", hint: "Chấp nhận ảnh JPG, PNG, WebP, tối đa 4 MB" },
  identity: { attr: "image/jpeg,image/png,image/webp", hint: "Chấp nhận ảnh JPG, PNG, WebP, tối đa 4 MB" },
};

interface UploadResponse {
  ok: boolean;
  message?: string;
}

function tooLargeMessage(bytes: number) {
  return `File quá lớn (${(bytes / (1024 * 1024)).toFixed(1)} MB), tối đa ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Hãy nén PDF hoặc chụp ảnh ở độ phân giải thấp hơn rồi nộp lại.`;
}

/** Thẻ nộp một loại giấy tờ: chọn file → gửi lên server → server cho Gemini đọc → trang tải lại với kết quả. */
export function DocumentUploadCard({
  type,
  status,
  problems,
  fileLabel,
}: {
  type: DocType;
  status: DocStatus;
  /** Lý do không hợp lệ (đã được code kiểm tra ở server). */
  problems: string[];
  /** "tên_file.png · 57 KB" của file đang lưu, nếu có. */
  fileLabel: string | null;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const Icon = ICONS[type];

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // cho phép chọn lại đúng file đó lần sau
    if (!file) return;

    setError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(tooLargeMessage(file.size));
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("file", file);
      const res = await fetch("/api/portal/documents", { method: "POST", body: form });
      if (res.status === 413) {
        // Vercel chặn body quá lớn bằng phản hồi dạng chữ (không phải JSON) trước khi tới server của ta.
        setError(tooLargeMessage(file.size));
        return;
      }
      let data: UploadResponse | null = null;
      try {
        data = (await res.json()) as UploadResponse;
      } catch {
        data = null; // phản hồi không phải JSON
      }
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "Không nộp được file (hệ thống trả về phản hồi không đọc được), bạn thử lại sau.");
        return;
      }
      router.refresh(); // tải lại dữ liệu hồ sơ từ server: trạng thái, lý do, thông tin trích xuất, đối chiếu điểm chuẩn
    } catch {
      setError("Có lỗi kết nối khi nộp file, bạn kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  const shownStatus: BadgeStatus = busy ? "dang_xu_ly" : status;

  return (
    <div>
      <Card className="flex aspect-video flex-col items-center justify-center gap-2 border-none bg-foreground/5 p-6 shadow-none ring-0">
        <Icon className="size-7 text-muted-foreground" />
        <span className="max-w-full truncate px-4 text-xs text-muted-foreground">
          {busy ? "Đang đọc giấy tờ bằng Gemini..." : (fileLabel ?? "Chưa có file")}
        </span>
      </Card>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{DOC_LABELS[type]}</h3>
          <DocStatusBadge status={shownStatus} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{ACCEPT[type].hint}</p>

        {!busy && status === "can_nop_lai" && problems.length > 0 && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">Cần nộp lại vì:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-red-600">{RESUBMIT_TIPS}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[type].attr}
          className="sr-only"
          onChange={onFileChosen}
          aria-label={`Chọn file cho ${DOC_LABELS[type]}`}
        />
        <Button
          variant={status === "chua_nop" ? "default" : "outline"}
          size="sm"
          className="mt-3"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload />
          {busy ? "Đang xử lý..." : status === "chua_nop" ? "Chọn file để nộp" : "Nộp lại file khác"}
        </Button>
      </div>
    </div>
  );
}
