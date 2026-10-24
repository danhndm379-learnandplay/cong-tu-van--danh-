import { CheckCircle2, TriangleAlert } from "lucide-react";
import { DOC_LABELS, RESUBMIT_TIPS, type DocType, type ProfileEvaluation } from "@/lib/portal-docs";
import { cn } from "@/lib/utils";

/**
 * Tình trạng hồ sơ: đủ và hợp lệ, hoặc báo RÕ đang thiếu giấy tờ nào, file nào cần nộp lại và vì sao.
 * Mọi thông tin ở đây do code kiểm tra (lib/portal-docs.ts), không hỏi lại AI.
 */
export function ProfileStatus({
  evaluation,
  fileNames,
}: {
  evaluation: ProfileEvaluation;
  /** Tên file đã nộp theo từng loại giấy tờ (để chỉ rõ "file nào"). */
  fileNames: Partial<Record<DocType, string | null>>;
}) {
  const ok = evaluation.complete;
  const Icon = ok ? CheckCircle2 : TriangleAlert;

  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border p-4 text-sm",
        ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="font-medium">{evaluation.headline}</p>

          {evaluation.missing.length > 0 && (
            <div>
              <p className="font-medium">Còn thiếu (chưa nộp):</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {evaluation.missing.map((type) => (
                  <li key={type}>{DOC_LABELS[type]}</li>
                ))}
              </ul>
            </div>
          )}

          {evaluation.invalid.length > 0 && (
            <div>
              <p className="font-medium">Cần nộp lại:</p>
              <ul className="mt-1 space-y-2">
                {evaluation.invalid.map(({ type, problems }) => (
                  <li key={type}>
                    <span className="font-medium">{DOC_LABELS[type]}</span>
                    {fileNames[type] ? <span className="break-all"> (file “{fileNames[type]}”)</span> : null}
                    <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                      {problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs opacity-90">{RESUBMIT_TIPS}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
