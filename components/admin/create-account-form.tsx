"use client";

import React from "react";
import { useActionState } from "react";
import { Copy, KeyRound, UserPlus } from "lucide-react";
import { createAccountAction, type CreateAccountState } from "@/app/admin/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MIN_PASSWORD_LENGTH, generatePassword, passwordProblem } from "@/lib/account-admin";
import { ROLE_LABELS } from "@/lib/admin-role";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";

/**
 * Form thêm tài khoản nội bộ: email, vai trò, mật khẩu (tự nhập hoặc tạo ngẫu nhiên). Mật khẩu CHỈ nằm ở trình duyệt của admin và trong
 * request gửi đi; server không gửi lại. Sau khi tạo xong, mật khẩu hiện MỘT lần để admin sao chép gửi cho đồng nghiệp qua kênh riêng.
 */
export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState<CreateAccountState, FormData>(createAccountAction, { status: "idle" });
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  // Mật khẩu vừa dùng để tạo (giữ ở trình duyệt để hiện một lần sau khi tạo thành công).
  const [submittedPassword, setSubmittedPassword] = React.useState("");
  const [handled, setHandled] = React.useState<CreateAccountState>(state);

  // Tạo xong thì xoá ô mật khẩu (so sánh với state đã xử lý thay vì dùng effect).
  if (state !== handled) {
    setHandled(state);
    if (state.status === "created") setPassword("");
  }

  const serverError = state.status === "error" ? state.message : null;
  const error = localError ?? serverError;
  const defaultEmail = state.status === "error" ? state.email : "";
  const defaultRole = state.status === "error" && state.role ? state.role : "nhan_vien";

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(submittedPassword);
      setCopied(true);
    } catch {
      setCopied(false); // trình duyệt chặn clipboard: admin tự bôi đen và sao chép
    }
  }

  return (
    <div className="space-y-4">
      {state.status === "created" && (
        <div role="status" className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>
            Đã tạo tài khoản <span className="font-medium">{state.email}</span> với vai trò {ROLE_LABELS[state.role]}. Hãy gửi mật khẩu cho họ qua kênh riêng (không gửi chung với email).
          </p>
          {submittedPassword && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-white px-2 py-1 font-mono text-sm select-all">{submittedPassword}</code>
              <Button type="button" variant="outline" size="sm" onClick={copyPassword}>
                <Copy />
                {copied ? "Đã sao chép" : "Sao chép"}
              </Button>
              <span className="text-xs">Mật khẩu chỉ hiện lần này, sẽ không xem lại được.</span>
            </div>
          )}
        </div>
      )}

      <form
        action={formAction}
        noValidate
        onSubmit={(e) => {
          const form = new FormData(e.currentTarget);
          const email = String(form.get("email") ?? "").trim();
          const problem = !email ? "Vui lòng nhập email." : !isValidEmail(email) ? EMAIL_INVALID_MESSAGE : passwordProblem(password);
          if (problem) e.preventDefault();
          else setSubmittedPassword(password);
          setLocalError(problem);
          setCopied(false);
        }}
        className="grid gap-4 md:grid-cols-[1fr_11rem_1fr_auto] md:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="new-email">Email</Label>
          <Input
            id="new-email"
            name="email"
            type="email"
            maxLength={320}
            autoComplete="off"
            placeholder="nhanvien@congty.com"
            defaultValue={defaultEmail}
            aria-invalid={error ? true : undefined}
            onChange={() => localError && setLocalError(null)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-role">Vai trò</Label>
          <select
            id="new-role"
            name="role"
            defaultValue={defaultRole}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="nhan_vien">{ROLE_LABELS.nhan_vien} (chỉ xem)</option>
            <option value="admin">{ROLE_LABELS.admin} (xem, sửa, xoá)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-password">Mật khẩu (tối thiểu {MIN_PASSWORD_LENGTH} ký tự)</Label>
          <div className="flex gap-2">
            <Input
              id="new-password"
              name="password"
              type={showPassword ? "text" : "password"}
              maxLength={200}
              autoComplete="new-password"
              value={password}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setPassword(e.target.value);
                if (localError) setLocalError(null);
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
              {showPassword ? "Ẩn" : "Hiện"}
            </Button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setPassword(generatePassword((bytes) => crypto.getRandomValues(bytes)));
              setShowPassword(true);
              setLocalError(null);
            }}
          >
            <KeyRound className="size-3" />
            Tạo mật khẩu ngẫu nhiên
          </button>
        </div>

        <Button type="submit" disabled={pending}>
          <UserPlus />
          {pending ? "Đang tạo..." : "Tạo tài khoản"}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive md:col-span-4">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
