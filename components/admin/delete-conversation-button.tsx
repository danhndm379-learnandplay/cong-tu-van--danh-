"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteConversationAction } from "@/app/admin/conversations/actions";
import { Button } from "@/components/ui/button";

/** Nút xoá hai bước (bấm "Xoá" rồi xác nhận). `redirectTo`: chuyển trang sau khi xoá xong (dùng ở trang chi tiết). */
export function DeleteConversationButton({
  id,
  redirectTo,
  compact,
}: {
  id: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          className="text-destructive"
        >
          <Trash2 />
          {compact ? "Xoá" : "Xoá cuộc trò chuyện"}
        </Button>
        {error && <p className="max-w-xs text-right text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2" title="Xoá vĩnh viễn, không khôi phục được">
      {!compact && (
        <span className="text-xs text-muted-foreground">Xoá vĩnh viễn, không khôi phục được?</span>
      )}
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Huỷ
      </Button>
      <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={pending}>
        {pending ? "Đang xoá..." : "Xoá vĩnh viễn"}
      </Button>
    </div>
  );
}
