import { connection } from "next/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CreateAccountForm } from "@/components/admin/create-account-form";
import { RoleSelect } from "@/components/admin/role-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/format";
import { listStaffAccounts } from "@/lib/staff-account-store";

export default async function AdminAccountsPage() {
  // CHỈ admin được vào (nhân viên bị chuyển về trang chủ admin). Mọi thao tác ghi cũng tự kiểm tra lại ở Server Action.
  const me = await requireAdmin();
  await connection();

  let accounts: Awaited<ReturnType<typeof listStaffAccounts>> | null = null;
  try {
    accounts = await listStaffAccounts();
  } catch (err) {
    console.error("[admin/accounts] Không tải được danh sách tài khoản:", err);
  }

  return (
    <>
      <AdminPageHeader
        title="Tài khoản nội bộ"
        description="Tài khoản đăng nhập khu quản trị. Admin xem, sửa, xoá dữ liệu; nhân viên chỉ xem. Học viên không nằm trong danh sách này."
      />

      {accounts === null ? (
        <Card className="p-6 text-sm text-destructive">Không tải được danh sách tài khoản. Kiểm tra kết nối Supabase rồi tải lại trang.</Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Tạo lúc</TableHead>
                <TableHead>Đăng nhập gần nhất</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.email ?? "—"}</TableCell>
                  <TableCell>
                    <RoleSelect userId={account.id} email={account.email ?? "tài khoản này"} role={account.role} isSelf={account.id === me.id} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(account.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {account.lastSignInAt ? formatDateTime(account.lastSignInAt) : "Chưa đăng nhập"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Thêm tài khoản</CardTitle>
          <CardDescription>
            Tài khoản được tạo sẵn và dùng được ngay (không gửi email). Nếu email đã là tài khoản học viên, hệ thống sẽ từ chối để không vô tình cấp quyền quản trị.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateAccountForm />
          <p className="mt-4 text-xs text-muted-foreground">
            Đổi vai trò có hiệu lực ngay, kể cả ở database (RLS): người bị hạ quyền không cần đăng xuất vẫn mất quyền sửa/xoá ở lần thao tác kế tiếp.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
