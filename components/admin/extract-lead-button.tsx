"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { extractLeadAction } from "@/app/admin/conversations/actions";
import { Button } from "@/components/ui/button";

/** Nút gọi Gemini trích xuất lead của cuộc trò chuyện (ghi đè lead cũ nếu có). */
export function ExtractLeadButton({
  conversationId,
  hasLead,
}: {
  conversationId: string;
  hasLead: boolean;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function extract() {
    setError(null);
    startTransition(async () => {
      const result = await extractLeadAction(conversationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button variant="outline" size="sm" onClick={extract} disabled={pending}>
        <Sparkles />
        {pending ? "Đang trích xuất..." : hasLead ? "Trích xuất lại" : "Trích xuất lead"}
      </Button>
      {error && <p className="max-w-xs text-xs text-destructive sm:text-right">{error}</p>}
    </div>
  );
}
