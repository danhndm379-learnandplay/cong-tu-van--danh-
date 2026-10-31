"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { approveQuoteAction } from "@/app/admin/requests/actions";
import { Button } from "@/components/ui/button";

/** Nút Duyệt hai bước (bấm rồi xác nhận), vì duyệt sẽ gửi tên, email và link đăng nhập của khách sang Make.com. */
export function ApproveQuoteButton({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function confirmApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveQuoteAction(id);
      if (!result.ok) setError(result.error);
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="icon-sm"
          variant="outline"
          aria-label="Duyệt"
          title="Duyệt và gửi link đăng nhập cho khách"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <Check className="size-3.5" />
        </Button>
        {error && <p role="alert" className="max-w-56 text-right text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="max-w-56 text-right text-xs text-muted-foreground">Duyệt và gửi link đăng nhập tới {email}?</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Huỷ
        </Button>
        <Button size="sm" onClick={confirmApprove} disabled={pending}>
          {pending ? "Đang gửi..." : "Duyệt"}
        </Button>
      </div>
    </div>
  );
}
