"use client";

import React from "react";
import { useActionState } from "react";
import { Mail, MailCheck } from "lucide-react";
import { sendMagicLinkAction, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMAIL_INVALID_MESSAGE, isValidEmail } from "@/lib/quote";

/** Form đăng nhập bằng magic link: nhập email, nhận link qua email, bấm vào link là đăng nhập xong (không cần mật khẩu). */
export function LoginForm({ initialError }: { initialError: string | null }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(sendMagicLinkAction, { status: "idle" });
  const [localError, setLocalError] = React.useState<string | null>(null);
  // Gửi xong thì hiện màn "kiểm tra email"; bấm "Dùng email khác" thì ẩn kết quả đó đi (lần gửi sau là kết quả mới nên hiện lại).
  const [dismissed, setDismissed] = React.useState<LoginState | null>(null);

  if (state.status === "sent" && dismissed !== state) {
    return (
      <div role="status" className="space-y-4">
        <div className="space-y-3 rounded-xl border border-primary/20 bg-accent p-5 text-accent-foreground">
          <div className="flex items-center gap-2 font-medium">
            <MailCheck className="size-5" />
            Đã gửi link đăng nhập
          </div>
          <p className="text-sm">
            Chúng tôi vừa gửi một email tới <span className="font-medium break-all">{state.email}</span>. Mở email và bấm vào
            link để đăng nhập. Link chỉ dùng được một lần.
          </p>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Chưa thấy email? Kiểm tra cả thư mục Spam hoặc Quảng cáo.</li>
          <li>Hãy mở link trên cùng trình duyệt bạn đang dùng để yêu cầu link.</li>
        </ul>
        <Button variant="outline" onClick={() => setDismissed(state)}>
          Dùng email khác hoặc gửi lại
        </Button>
      </div>
    );
  }

  const error = localError ?? (state.status === "error" ? state.message : initialError);
  const defaultEmail = state.status === "error" || state.status === "sent" ? state.email : "";

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={(e) => {
        // Email sai định dạng thì báo ngay và KHÔNG gửi lên server.
        const value = String(new FormData(e.currentTarget).get("email") ?? "");
        if (!value.trim()) {
          e.preventDefault();
          setLocalError("Vui lòng nhập email.");
        } else if (!isValidEmail(value)) {
          e.preventDefault();
          setLocalError(EMAIL_INVALID_MESSAGE);
        } else {
          setLocalError(null);
        }
      }}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          autoFocus
          placeholder="ban@email.com"
          defaultValue={defaultEmail}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : undefined}
          onChange={() => localError && setLocalError(null)}
        />
        {error && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        <Mail />
        {pending ? "Đang gửi..." : "Gửi link đăng nhập"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Không cần mật khẩu. Chúng tôi gửi một link vào email của bạn, bấm vào link đó là đăng nhập xong.
      </p>
    </form>
  );
}
