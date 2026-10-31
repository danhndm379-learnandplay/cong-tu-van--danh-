"use client";

import React from "react";
import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { adminSignInAction, type AdminLoginState } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";

/** Form đăng nhập admin bằng email + mật khẩu. `next`: trang admin quay lại sau khi đăng nhập (đã được làm sạch ở server). */
export function AdminLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(adminSignInAction, { status: "idle" });
  const [localError, setLocalError] = React.useState<string | null>(null);

  const error = localError ?? (state.status === "error" ? state.message : null);
  const defaultEmail = state.status === "error" ? state.email : "";

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        // Thiếu hoặc sai định dạng thì báo ngay và KHÔNG gửi lên server.
        const form = new FormData(e.currentTarget);
        const email = String(form.get("email") ?? "");
        const password = String(form.get("password") ?? "");
        const problem = !email.trim() ? "Vui lòng nhập email." : !isValidEmail(email) ? EMAIL_INVALID_MESSAGE : !password ? "Vui lòng nhập mật khẩu." : null;
        if (problem) e.preventDefault();
        setLocalError(problem);
      }}
      className="space-y-5"
    >
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="username"
          autoFocus
          placeholder="ban@congty.com"
          defaultValue={defaultEmail}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          onChange={() => localError && setLocalError(null)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mật khẩu</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          maxLength={200}
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "admin-login-error" : undefined}
          onChange={() => localError && setLocalError(null)}
        />
        {error && (
          <p id="admin-login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <LogIn />
        {pending ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Chỉ dành cho đội ngũ DuHoc24. Tài khoản do quản trị viên tạo sẵn, không có đăng ký công khai.
      </p>
    </form>
  );
}
