import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScore } from "@/lib/format";
import type { Criterion, SchoolMatchResult, StudentScores } from "@/lib/school-match";
import { cn } from "@/lib/utils";

function CriterionLine({ label, c }: { label: string; c: Criterion }) {
  return (
    <p className={cn("flex items-center justify-end gap-1.5", c.passed ? "text-green-700" : "text-red-600")}>
      <span>
        {label}: {formatScore(c.actual)} {c.passed ? "≥" : "<"} {formatScore(c.required)}
      </span>
      {c.passed ? <Check className="size-3.5" /> : <X className="size-3.5" />}
    </p>
  );
}

/**
 * Kết quả so sánh điểm của học viên với điểm chuẩn từng trường. Kết quả đạt/chưa đạt do PHÉP SO SÁNH SỐ (lib/school-match.ts)
 * quyết định, mỗi dòng ghi rõ số liệu hai vế nên có thể tự kiểm tra lại.
 */
export function SchoolMatch({ matches, scores }: { matches: SchoolMatchResult[]; scores: StudentScores }) {
  const ordered = [...matches].sort((a, b) => Number(b.passed) - Number(a.passed));
  const passedCount = matches.filter((m) => m.passed).length;
  const converted = scores.gpaScale !== 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đối chiếu điểm chuẩn</CardTitle>
        <p className="text-sm text-muted-foreground">
          Bạn đạt yêu cầu <span className="font-medium text-foreground">{passedCount}/{matches.length}</span> trường. Trường đạt khi cả điểm học tập lẫn IELTS đều không thấp hơn điểm chuẩn.
        </p>
        {converted && (
          <p className="text-xs text-muted-foreground">
            Điểm học tập {formatScore(scores.gpa)}/{scores.gpaScale} được quy đổi tuyến tính về thang 10 để so sánh (điểm chuẩn các trường tính theo thang 10).
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {ordered.map((m) => (
          <div
            key={m.school.id}
            className={cn(
              "flex items-center justify-between gap-4 rounded-xl border p-4",
              m.passed ? "border-green-200 bg-green-50" : "border-border bg-muted/30",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  m.passed ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500",
                )}
                aria-label={m.passed ? "Đạt" : "Chưa đạt"}
              >
                {m.passed ? <Check className="size-4" /> : <X className="size-4" />}
              </span>
              <div>
                <p className="font-medium">{m.school.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.school.country} · {m.passed ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"}
                </p>
              </div>
            </div>
            <div className="shrink-0 text-right text-sm">
              <CriterionLine label="Điểm học tập" c={m.gpa} />
              <CriterionLine label="IELTS" c={m.ielts} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
