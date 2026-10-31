import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_AFTER_LOGIN, loginErrorMessage } from "@/lib/auth-redirect";
import { getCurrentUser } from "@/lib/supabase-auth";

export const metadata: Metadata = {
  title: "Đăng nhập — DuHoc24",
  description: "Đăng nhập vào cổng hồ sơ du học bằng link gửi qua email, không cần mật khẩu.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Đã đăng nhập rồi thì vào thẳng cổng hồ sơ.
  if (await getCurrentUser()) redirect(DEFAULT_AFTER_LOGIN);

  const initialError = loginErrorMessage((await searchParams).error);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24 pt-32">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-medium tracking-tight">Đăng nhập</CardTitle>
            <CardDescription>Nhập email của bạn để nhận link đăng nhập vào cổng hồ sơ.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm initialError={initialError} />
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
