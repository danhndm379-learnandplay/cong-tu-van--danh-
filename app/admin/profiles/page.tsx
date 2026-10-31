import Link from "next/link";
import { connection } from "next/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusDot, docStatusMeta } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStaff } from "@/lib/admin-guard";
import { listProfilesForAdmin } from "@/lib/admin-student-store";
import { formatDateTime } from "@/lib/format";
import { DOC_SHORT_NAMES, DOC_TYPES } from "@/lib/portal-docs";

export default async function AdminProfilesPage() {
  // Dữ liệu cá nhân của học viên: admin và nhân viên xem được (RLS cho phép), học viên thường thì không.
  await requireStaff();
  await connection();

  let profiles: Awaited<ReturnType<typeof listProfilesForAdmin>> | null = null;
  try {
    profiles = await listProfilesForAdmin();
  } catch (err) {
    console.error("[admin/profiles] Không tải được danh sách hồ sơ:", err);
  }

  return (
    <>
      <AdminPageHeader
        title="Hồ sơ học viên"
        description="Hồ sơ học viên đã nộp giấy tờ và trạng thái 3 giấy tờ (bảng điểm, IELTS, CMND/hộ chiếu)."
      />

      {profiles === null ? (
        <Card className="p-6 text-sm text-destructive">Không tải được danh sách hồ sơ. Kiểm tra kết nối Supabase rồi tải lại trang.</Card>
      ) : profiles.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Chưa có học viên nào nộp hồ sơ.</Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Học viên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Trạng thái 3 giấy tờ</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.name ?? <span className="text-muted-foreground">Chưa đọc được tên</span>}</TableCell>
                  <TableCell className="text-muted-foreground">{profile.email ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {DOC_TYPES.map((type) => (
                        <span key={type} title={`${DOC_SHORT_NAMES[type]}: ${docStatusMeta[profile.docs[type]].label}`} className="flex items-center gap-1.5">
                          <StatusDot tone={docStatusMeta[profile.docs[type]].tone} />
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground">{profile.complete ? "Đủ, hợp lệ" : "Chưa hoàn tất"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(profile.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/profiles/${profile.id}`}>Xem</Link>} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
