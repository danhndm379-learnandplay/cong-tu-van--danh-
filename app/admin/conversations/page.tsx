import Link from "next/link";
import { Download } from "lucide-react";
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
import { DeleteConversationButton } from "@/components/admin/delete-conversation-button";
import { LeadQualityBadge } from "@/components/admin/lead-quality-badge";
import { requireAdmin } from "@/lib/admin-guard";
import { ADMIN_PAGE_SIZE, listConversationsForAdmin } from "@/lib/chat-store";
import { formatDateTime } from "@/lib/format";
import { parseQualityFilter, type LeadQualityFilter } from "@/lib/lead-sanitize";

const FILTERS: { value: LeadQualityFilter | null; label: string }[] = [
  { value: null, label: "Tất cả" },
  { value: "good", label: "Good" },
  { value: "ok", label: "OK" },
  { value: "spam", label: "Spam" },
  { value: "none", label: "Chưa trích xuất" },
];

function listHref(page: number, quality: LeadQualityFilter | null) {
  const params = new URLSearchParams();
  if (quality) params.set("quality", quality);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/conversations${query ? `?${query}` : ""}`;
}

export default async function AdminConversationsPage({
  searchParams,
}: PageProps<"/admin/conversations">) {
  await requireAdmin();

  const query = await searchParams;
  const rawPage = query.page;
  const page = Math.max(1, Number.parseInt(Array.isArray(rawPage) ? rawPage[0] : (rawPage ?? "1"), 10) || 1);
  const quality = parseQualityFilter(query.quality);

  let data: Awaited<ReturnType<typeof listConversationsForAdmin>> | null = null;
  try {
    data = await listConversationsForAdmin(page, quality);
  } catch (err) {
    console.error("[admin/conversations] Không tải được danh sách:", err);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / ADMIN_PAGE_SIZE)) : 1;
  // "Chưa trích xuất" không có lead nào để xuất nên ẩn nút.
  const exportHref = `/admin/conversations/export${quality && quality !== "none" ? `?quality=${quality}` : ""}`;

  return (
    <>
      <AdminPageHeader
        title="Hội thoại"
        description="Lịch sử hội thoại thật của khách với chatbot trên trang chủ, đọc trực tiếp từ database. Đây là dữ liệu riêng tư của khách."
        action={
          quality !== "none" ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={exportHref} download>
                  <Download />
                  Xuất CSV lead{quality ? ` (${quality})` : ""}
                </a>
              }
            />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Chất lượng lead:</span>
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={quality === f.value ? "default" : "outline"}
            size="sm"
            nativeButton={false}
            render={<Link href={listHref(1, f.value)}>{f.label}</Link>}
          />
        ))}
      </div>

      {!data ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Không tải được dữ liệu hội thoại từ database. Kiểm tra biến SUPABASE_URL và
          SUPABASE_SECRET_KEY rồi thử lại.
        </Card>
      ) : data.items.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {quality
            ? "Không có cuộc trò chuyện nào khớp bộ lọc này."
            : page > 1
              ? "Trang này không có dữ liệu."
              : "Chưa có cuộc trò chuyện nào."}
        </Card>
      ) : (
        <>
          {/* Màn hình nhỏ: dạng thẻ để nút Xem/Xoá luôn nhìn thấy, không phải cuộn ngang. */}
          <div className="space-y-3 md:hidden">
            {data.items.map((conv) => (
              <Card key={conv.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{formatDateTime(conv.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      Gần nhất {formatDateTime(conv.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <LeadQualityBadge quality={conv.leadQuality} />
                    <span className="text-xs text-muted-foreground">{conv.messageCount} tin nhắn</span>
                  </div>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {conv.firstUserMessage ?? "—"}
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/conversations/${conv.id}`}>Xem</Link>}
                  />
                  <DeleteConversationButton id={conv.id} compact />
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bắt đầu</TableHead>
                  <TableHead>Hoạt động gần nhất</TableHead>
                  <TableHead>Số tin nhắn</TableHead>
                  <TableHead>Chất lượng lead</TableHead>
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
                    <TableCell>
                      <LeadQualityBadge quality={conv.leadQuality} />
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {conv.firstUserMessage ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/admin/conversations/${conv.id}`}>Xem</Link>}
                        />
                        <DeleteConversationButton id={conv.id} compact />
                      </div>
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
                  render={<Link href={listHref(page - 1, quality)}>Trang trước</Link>}
                />
              )}
              {page < totalPages && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={listHref(page + 1, quality)}>Trang sau</Link>}
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
