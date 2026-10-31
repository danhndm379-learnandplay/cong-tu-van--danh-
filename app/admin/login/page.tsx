import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Logo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeAdminNextPath } from "@/lib/admin-role";
import { getStaffUser } from "@/lib/admin-guard";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị — DuHoc24",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const rawNext = (await searchParams).next;
  const next = safeAdminNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);

  // Đã đăng nhập quản trị (admin hoặc nhân viên) thì vào thẳng trang cần đến.
  if (await getStaffUser()) redirect(next);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-6 flex flex-col items-center gap-1">
        <Logo uniColor />
        <p className="text-xs text-muted-foreground">Admin dashboard</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-medium tracking-tight">Đăng nhập quản trị</CardTitle>
          <CardDescription>Nhập email và mật khẩu của tài khoản quản trị.</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
