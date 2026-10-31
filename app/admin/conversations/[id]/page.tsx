import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteConversationButton } from "@/components/admin/delete-conversation-button";
import { LeadCard } from "@/components/admin/lead-card";
import { requireStaff } from "@/lib/admin-guard";
import { getConversationForAdmin } from "@/lib/chat-store";
import { formatDateTime } from "@/lib/format";
import { getLeadForAdmin, type StoredLead } from "@/lib/lead-store";
import { cn } from "@/lib/utils";

export default async function AdminConversationDetailPage({
  params,
}: PageProps<"/admin/conversations/[id]">) {
  const { canWrite } = await requireStaff();

  const { id } = await params;
  let conversation: Awaited<ReturnType<typeof getConversationForAdmin>>;
  try {
    conversation = await getConversationForAdmin(id);
  } catch (err) {
    console.error("[admin/conversations/[id]] Không tải được cuộc trò chuyện:", err);
    return (
      <>
        <BackButton />
        <Card className="p-6 text-sm text-muted-foreground">
          Không tải được cuộc trò chuyện này từ database. Thử lại sau.
        </Card>
      </>
    );
  }
  if (!conversation) notFound();

  let lead: StoredLead | null = null;
  let leadLoadFailed = false;
  try {
    lead = await getLeadForAdmin(conversation.id);
  } catch (err) {
    console.error("[admin/conversations/[id]] Không tải được lead:", err);
    leadLoadFailed = true;
  }

  return (
    <>
      <BackButton />
      <AdminPageHeader
        title="Chi tiết cuộc trò chuyện"
        description={`Bắt đầu ${formatDateTime(conversation.createdAt)} · Hoạt động gần nhất ${formatDateTime(conversation.lastMessageAt)} · ${conversation.messages.length} tin nhắn`}
        action={canWrite ? <DeleteConversationButton id={conversation.id} redirectTo="/admin/conversations" /> : undefined}
      />

      <LeadCard
        conversationId={conversation.id}
        lead={lead}
        latestMessageId={conversation.messages.at(-1)?.id ?? null}
        loadFailed={leadLoadFailed}
        canWrite={canWrite}
      />

      <Card className="p-4 sm:p-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {conversation.messages.map((m) => {
            const fromUser = m.from === "user";
            return (
              <div key={m.id} className={cn("flex flex-col", fromUser ? "items-end" : "items-start")}>
                <span className="mb-1 text-xs text-muted-foreground">
                  {fromUser ? "Khách" : "Chatbot"} · {formatDateTime(m.createdAt)}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                    fromUser
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
          {conversation.truncated && (
            <p className="text-center text-xs text-muted-foreground">
              Cuộc trò chuyện dài hơn giới hạn hiển thị, các tin nhắn mới hơn đã bị ẩn.
            </p>
          )}
        </div>
      </Card>
    </>
  );
}

function BackButton() {
  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={
          <Link href="/admin/conversations">
            <ArrowLeft className="size-4" />
            Danh sách hội thoại
          </Link>
        }
      />
    </div>
  );
}
