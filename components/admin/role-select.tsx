"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { changeRoleAction } from "@/app/admin/accounts/actions";
import { Button } from "@/components/ui/button";
import type { AccountRole } from "@/lib/account-admin";
import { ROLE_LABELS } from "@/lib/admin-role";

/**
 * Đổi vai trò một tài khoản nội bộ (hai bước: chọn rồi xác nhận). Tài khoản của chính mình chỉ hiện nhãn, không đổi được.
 * Đây chỉ là giao diện; Server Action `changeRoleAction` tự kiểm tra lại quyền admin, chặn tự đổi và chặn hạ admin cuối cùng.
 */
export function RoleSelect({ userId, email, role, isSelf }: { userId: string; email: string; role: AccountRole; isSelf: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = React.useState<AccountRole>(role);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (isSelf) {
    return (
      <span className="text-sm">
        {ROLE_LABELS[role]} <span className="text-xs text-muted-foreground">(bạn)</span>
      </span>
    );
  }

  const changed = choice !== role;

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await changeRoleAction(userId, choice);
      if (!result.ok) {
        setError(result.error);
        setChoice(role);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <select
        aria-label={`Vai trò của ${email}`}
        value={choice}
        disabled={pending}
        onChange={(e) => {
          setError(null);
          setChoice(e.target.value as AccountRole);
        }}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="admin">{ROLE_LABELS.admin}</option>
        <option value="nhan_vien">{ROLE_LABELS.nhan_vien}</option>
      </select>
      {changed && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Đổi thành {ROLE_LABELS[choice]}?</span>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Đang lưu..." : "Xác nhận"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setChoice(role)} disabled={pending}>
            Huỷ
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
