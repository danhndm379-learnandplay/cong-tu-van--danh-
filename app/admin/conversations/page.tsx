import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/admin-guard";
import { ADMIN_PAGE_SIZE, listConversationsForAdmin } from "@/lib/chat-store";
import { formatDateTime } from "@/lib/format";

export default async function AdminConversationsPage({
  searchParams,
}: PageProps<"/admin/conversations">) {
  await requireAdmin();

  const rawPage = (await searchParams).page;
  const page = Math.max(1, Number.parseInt(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1"), 10) || 1);

  let data: Awaited<ReturnType<typeof listConversationsForAdmin>> | null = null;
  try {
    data = await listConversationsForAdmin(page);
  } catch (err) {
    console.error("[admin/conversations] Không tải được danh sách:", err);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE)) : 1;

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại thật của khách với chatbot trên trang chủ, đọc trực tiếp từ database. Đây là dữ liệu riêng tư của khách."
      />

      {!data ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Không tải được dữ liệu hội thoại từ database. Kiểm tra biến SUPABASE_URL và
          SUPABASE_SECRET_KEY rồi thử lại.
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {page > 1 ? "Trang này không có dữ liệu." : "Chưa có cuộc trò chuyện nào."}
        </Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bắt đầu</TableHead>
                  <TableHead>Hoạt động gần nhất</TableHead>
                  <TableHead>Số tin nhắn</TableHead>
                  <TableHead>Câu hỏi đầu tiên của khách</TableHead>
                  <TableHead className="text-right">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="whitespace-nowrap font-medium">
                      {formatDateTime(conv.createdAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(conv.lastMessageAt)}
                    </TableCell>
                    <TableCell>{conv.messageCount} tin nhắn</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {conv.firstUserMessage ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/admin/conversations/${conv.id}`}>Xem</Link>}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Trang {page}/{totalPages} · Tổng {data.total} cuộc trò chuyện
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/admin/conversations?page=${page - 1}`}>Trang trước</Link>}
                />
              )}
              {page < totalPages && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/admin/conversations?page=${page + 1}`}>Trang sau</Link>}
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
