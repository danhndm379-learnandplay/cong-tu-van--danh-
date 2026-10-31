import { connection } from "next/server";
import { ApproveQuoteButton } from "@/components/admin/approve-quote-button";
import { AdminPageHeader } from "@/components/admin/page-header";
import { RejectQuoteButton } from "@/components/admin/reject-quote-button";
import { Card } from "@/components/ui/card";
import { RequestStatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/format";
import { QUOTE_PACKAGE_NAMES } from "@/lib/quote";
import { listQuoteRequests } from "@/lib/quote-store";

const LEVEL_LABELS: Record<string, string> = { thpt: "THPT", dai_hoc: "Đại học", thac_si: "Thạc sĩ" };

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN") + "₫";
}

function packageLabel(id: string) {
  return (QUOTE_PACKAGE_NAMES as Record<string, string>)[id] ?? id;
}

export default async function AdminRequestsPage() {
  // Dữ liệu khách (tên, email): kiểm tra đăng nhập nếu đã bật, và đọc mới mỗi lần xem.
  await requireAdmin();
  await connection();

  let requests: Awaited<ReturnType<typeof listQuoteRequests>> | null = null;
  try {
    requests = await listQuoteRequests();
  } catch (err) {
    console.error("[admin/requests] Không tải được yêu cầu báo giá:", err);
  }

  return (
    <>
      <AdminPageHeader
        title="Yêu cầu"
        description="Danh sách yêu cầu báo giá gửi từ trang chủ, chờ đội ngũ duyệt."
      />

      {requests === null ? (
        <Card className="p-6 text-sm text-destructive">
          Không tải được danh sách yêu cầu báo giá. Kiểm tra kết nối Supabase rồi tải lại trang.
        </Card>
      ) : requests.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Chưa có yêu cầu báo giá nào.</Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên khách</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Quốc gia</TableHead>
                <TableHead>Bậc học</TableHead>
                <TableHead>Gói dịch vụ</TableHead>
                <TableHead>Báo giá</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{req.email}</TableCell>
                  <TableCell>{req.studyCountry}</TableCell>
                  <TableCell>{LEVEL_LABELS[req.educationLevel] ?? req.educationLevel}</TableCell>
                  <TableCell>{packageLabel(req.servicePackage)}</TableCell>
                  <TableCell>{formatVnd(req.price)}</TableCell>
                  <TableCell>
                    <RequestStatusBadge status={req.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(req.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-start justify-end gap-2">
                      {req.status === "cho_duyet" ? (
                        <>
                          <ApproveQuoteButton id={req.id} email={req.email} />
                          <RejectQuoteButton id={req.id} name={req.customerName} />
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
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
