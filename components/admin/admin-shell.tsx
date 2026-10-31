"use client";

import { usePathname } from "next/navigation";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/sidebar";
import type { StaffRole } from "@/lib/admin-role";

/** Khung dashboard (thanh bên + menu điện thoại). Riêng trang đăng nhập admin thì không hiện khung. */
export function AdminShell({ email, role, children }: { email: string | null; role: StaffRole | null; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar email={email} role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
