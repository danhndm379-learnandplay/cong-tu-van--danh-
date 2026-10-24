"use client";

import React from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdviceItem, ScholarshipAdvice } from "@/lib/scholarship-advice";
import { cn } from "@/lib/utils";

type PanelState = "idle" | "loading" | "error";

function ItemCard({ item }: { item: AdviceItem }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        item.eligible ? "border-green-200 bg-green-50" : "border-border bg-muted/30",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {item.school} · {item.country}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            item.eligible ? "bg-green-100 text-green-700 ring-green-200" : "bg-gray-100 text-gray-600 ring-gray-200",
          )}
        >
          {item.eligible ? "Đủ điều kiện tối thiểu" : "Chưa đủ điều kiện"}
        </span>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Điều kiện tối thiểu (từ dữ liệu hệ thống)</dt>
          <dd>{item.condition}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Mức hỗ trợ (từ dữ liệu hệ thống)</dt>
          <dd>{item.support}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm">
        <span className="text-xs text-muted-foreground">Nhận định của AI: </span>
        {item.reason}
      </p>
    </div>
  );
}

/**
 * Gợi ý học bổng do AI tạo bằng function calling (server: lib/scholarship-advisor.ts). Nếu chưa có gợi ý còn khớp với hồ sơ,
 * khung này tự gọi server MỘT lần khi hiện ra; học viên có thể bấm "Gợi ý lại" để tạo mới.
 */
export function ScholarshipPanel({
  initialAdvice,
  autoGenerate,
}: {
  initialAdvice: ScholarshipAdvice | null;
  autoGenerate: boolean;
}) {
  const [advice, setAdvice] = React.useState<ScholarshipAdvice | null>(initialAdvice);
  const [state, setState] = React.useState<PanelState>(autoGenerate && !initialAdvice ? "loading" : "idle");
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);

  const run = React.useCallback(async (force: boolean) => {
    try {
      const res = await fetch("/api/portal/scholarships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = (await res.json()) as { ok: boolean; advice?: ScholarshipAdvice | null; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "Chưa tạo được gợi ý học bổng, bạn thử lại sau.");
        setState("error");
        return;
      }
      setAdvice(data.advice ?? null);
      setError(null);
      setState("idle");
    } catch {
      setError("Có lỗi kết nối khi tạo gợi ý học bổng, bạn thử lại sau.");
      setState("error");
    }
  }, []);

  React.useEffect(() => {
    if (autoGenerate && !initialAdvice && !started.current) {
      started.current = true;
      void run(false);
    }
  }, [autoGenerate, initialAdvice, run]);

  function regenerate(force: boolean) {
    setState("loading");
    setError(null);
    void run(force);
  }

  const eligible = advice?.items.filter((i) => i.eligible) ?? [];
  const notEligible = advice?.items.filter((i) => !i.eligible) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5" />
          Gợi ý học bổng
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          AI tra cứu học bổng của các trường bạn đã đạt yêu cầu rồi đối chiếu với điểm học tập và IELTS trong hồ sơ.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" />
            AI đang tra cứu học bổng của các trường bạn đạt yêu cầu...
          </p>
        )}

        {state === "error" && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => regenerate(false)}>
              <RefreshCw />
              Thử lại
            </Button>
          </div>
        )}

        {advice && state !== "loading" && (
          <>
            <p className="text-sm">{advice.summary}</p>

            {eligible.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Học bổng phù hợp với hồ sơ của bạn</h3>
                {eligible.map((item) => (
                  <ItemCard key={item.scholarshipId} item={item} />
                ))}
              </div>
            )}

            {notEligible.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Đã tra cứu nhưng chưa đủ điều kiện</h3>
                {notEligible.map((item) => (
                  <ItemCard key={item.scholarshipId} item={item} />
                ))}
              </div>
            )}

            {advice.items.length === 0 && (
              <p className="text-sm text-muted-foreground">AI không tìm thấy học bổng nào trong dữ liệu để gợi ý cho hồ sơ này.</p>
            )}

            <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
              <p>
                AI đã tra cứu: {advice.lookups.length ? advice.lookups.map((l) => `${l.schoolName} (${l.found} học bổng)`).join("; ") : "chưa tra cứu trường nào"}.
              </p>
              <p>
                Đáp ứng điều kiện tối thiểu chưa đảm bảo nhận được học bổng; nhà trường quyết định. Điều kiện và mức hỗ trợ
                hiển thị lấy từ dữ liệu của hệ thống để bạn tự đối chiếu với nhận định của AI.
              </p>
              <Button variant="outline" size="sm" onClick={() => regenerate(true)}>
                <RefreshCw />
                Gợi ý lại
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
