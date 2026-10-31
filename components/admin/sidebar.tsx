"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileClock,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import { adminSignOutAction } from "@/app/admin/login/actions";
import { ROLE_LABELS, type StaffRole } from "@/lib/admin-role";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export const adminNavItems: { name: string; href: string; icon: LucideIcon }[] = [
  { name: "Tổng quan", href: "/admin", icon: LayoutDashboard },
  { name: "Yêu cầu", href: "/admin/requests", icon: FileClock },
  { name: "Trường tham chiếu", href: "/admin/schools", icon: School },
  { name: "Hồ sơ học viên", href: "/admin/profiles", icon: Users },
  { name: "Hội thoại", href: "/admin/conversations", icon: MessageSquare },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebar({ email, role }: { email: string | null; role: StaffRole | null }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:flex lg:flex-col">
      <div className="border-b px-5 py-5">
        <Link href="/">
          <Logo uniColor />
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">Admin dashboard</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {adminNavItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm duration-150",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground/70 duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          Xem trang khách ↗
        </Link>
        <div className="px-3 pt-2">
          {email && (
            <p className="truncate text-xs text-muted-foreground" title={email}>
              {email}
            </p>
          )}
          {role && (
            <p className="mt-0.5 text-xs font-medium text-sidebar-foreground/80">
              {ROLE_LABELS[role]}
              {role === "nhan_vien" && " (chỉ xem)"}
            </p>
          )}
          <form action={adminSignOutAction}>
            <button
              type="submit"
              className="mt-1 flex items-center gap-2 text-sm text-sidebar-foreground/70 duration-150 hover:text-sidebar-accent-foreground"
            >
              <LogOut className="size-4" />
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b bg-sidebar px-3 py-2 lg:hidden">
      {adminNavItems.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs duration-150",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent",
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {item.name}
          </Link>
        );
      })}
      <form action={adminSignOutAction} className="ml-auto shrink-0">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-sidebar-foreground/70 duration-150 hover:bg-sidebar-accent"
        >
          <LogOut className="size-3.5 shrink-0" />
          Đăng xuất
        </button>
      </form>
    </nav>
  );
}
