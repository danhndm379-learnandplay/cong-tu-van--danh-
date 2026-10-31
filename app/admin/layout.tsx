import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { getStaffUser } from "@/lib/admin-guard";

// Khu vực admin không nên xuất hiện trên công cụ tìm kiếm. Lưu ý: noindex chỉ giảm khả năng bị tìm thấy, KHÔNG phải bảo vệ.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Layout chỉ để hiện email và vai trò đang đăng nhập; việc chặn người không có vai trò quản trị do proxy.ts và `requireStaff()` trong từng trang làm
// (layout không chạy lại ở mọi lần chuyển trang nên không được dùng làm chốt bảo vệ duy nhất).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getStaffUser();
  return (
    <AdminShell email={user?.email ?? null} role={user?.role ?? null}>
      {children}
    </AdminShell>
  );
}
