import type { Metadata } from "next";
import { AdminSidebar, AdminMobileNav } from "@/components/admin/sidebar";

// Khu vực admin không nên xuất hiện trên công cụ tìm kiếm. Lưu ý: noindex chỉ giảm khả năng bị tìm thấy, KHÔNG phải bảo vệ.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
