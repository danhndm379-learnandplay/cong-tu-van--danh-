"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteStudentProfileAction } from "@/app/admin/profiles/actions";
import { Button } from "@/components/ui/button";

/** Nút xoá hồ sơ học viên hai bước (chỉ hiển thị cho admin). Xoá vĩnh viễn hồ sơ và mọi giấy tờ của hồ sơ. */
export function DeleteProfileButton({ profileId, name }: { profileId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteStudentProfileAction(profileId);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push("/admin/profiles");
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          <Trash2 />
          Xoá hồ sơ
        </Button>
        {error && <p role="alert" className="max-w-xs text-right text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="max-w-xs text-right text-xs text-muted-foreground">Xoá vĩnh viễn hồ sơ của {name} và mọi giấy tờ, không khôi phục được?</span>
      <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Huỷ
      </Button>
      <Button variant="destructive" size="sm" onClick={confirmDelete} disabled={pending}>
        {pending ? "Đang xoá..." : "Xoá vĩnh viễn"}
      </Button>
    </div>
  );
}
