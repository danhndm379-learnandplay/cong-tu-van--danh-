"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { rejectQuoteAction } from "@/app/admin/requests/actions";
import { Button } from "@/components/ui/button";

/** Nút Từ chối hai bước (bấm rồi xác nhận). Từ chối = xoá vĩnh viễn yêu cầu, nên luôn hỏi lại. */
export function RejectQuoteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function confirmReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectQuoteAction(id);
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
          aria-label="Từ chối"
          title="Từ chối và xoá yêu cầu"
          className="text-destructive"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <X className="size-3.5" />
        </Button>
        {error && <p role="alert" className="max-w-56 text-right text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="max-w-56 text-right text-xs text-muted-foreground">Từ chối và xoá vĩnh viễn yêu cầu của {name}?</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
          Huỷ
        </Button>
        <Button variant="destructive" size="sm" onClick={confirmReject} disabled={pending}>
          {pending ? "Đang xoá..." : "Từ chối & xoá"}
        </Button>
      </div>
    </div>
  );
}
