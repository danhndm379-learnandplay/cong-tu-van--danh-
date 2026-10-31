import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/supabase-auth";

/** Thanh trạng thái đăng nhập ở đầu cổng hồ sơ: hiện email đang đăng nhập kèm nút Đăng xuất, hoặc nút Đăng nhập. */
export function UserBar({ user }: { user: CurrentUser | null }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
      {user ? (
        <>
          <span className="text-muted-foreground">
            Đang đăng nhập với <span className="font-medium text-foreground break-all">{user.email ?? "tài khoản của bạn"}</span>
          </span>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut />
              Đăng xuất
            </Button>
          </form>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">Bạn chưa đăng nhập.</span>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/login" />}>
            <LogIn />
            Đăng nhập
          </Button>
        </>
      )}
    </div>
  );
}
