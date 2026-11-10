"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approveQuoteAction, rejectQuoteAction } from "@/app/admin/requests/actions";
import { Button } from "@/components/ui/button";

type Decision = "approve" | "reject";

/**
 * Nút Duyệt / Từ chối cho một yêu cầu báo giá, mỗi nút hai bước (bấm rồi xác nhận).
 * Duyệt sẽ gửi tên, email và link đăng nhập của khách sang Make.com; Từ chối chỉ đổi trạng thái.
 */
export function QuoteDecisionButtons({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState<Decision | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function confirm(decision: Decision) {
    setError(null);
    startTransition(async () => {
      const result = decision === "approve" ? await approveQuoteAction(id) : await rejectQuoteAction(id);
      if (!result.ok) setError(result.error);
      setConfirming(null);
      router.refresh();
    });
  }

  function ask(decision: Decision) {
    setError(null);
    setConfirming(decision);
  }

  if (confirming) {
    const approving = confirming === "approve";
    return (
      <div className="flex flex-col items-end gap-1.5">
        <span className="max-w-56 text-right text-xs text-muted-foreground">
          {approving ? `Duyệt và gửi link đăng nhập tới ${email}?` : "Từ chối yêu cầu này?"}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfirming(null)} disabled={pending}>
            Huỷ
          </Button>
          <Button
            size="sm"
            variant={approving ? "default" : "destructive"}
            onClick={() => confirm(confirming)}
            disabled={pending}
          >
            {pending ? "Đang xử lý..." : approving ? "Duyệt" : "Từ chối"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button size="icon-sm" variant="outline" aria-label="Duyệt" title="Duyệt và gửi link đăng nhập cho khách" onClick={() => ask("approve")}>
          <Check className="size-3.5" />
        </Button>
        <Button size="icon-sm" variant="outline" aria-label="Từ chối" title="Từ chối yêu cầu" onClick={() => ask("reject")}>
          <X className="size-3.5" />
        </Button>
      </div>
      {error && (
        <p role="alert" className="max-w-56 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
