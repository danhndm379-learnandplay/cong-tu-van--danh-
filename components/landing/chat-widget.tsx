"use client";

import React from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  chatErrorMessages,
  chatGreeting,
  type ChatErrorCode,
  type StoredMessage,
} from "@/lib/chatbot-config";
import { suggestedQuestions } from "@/lib/chatbot-qna";
import { cn } from "@/lib/utils";

// Lịch sử hội thoại KHÔNG nằm ở trình duyệt: mọi tin nhắn hiển thị ở đây đều được đọc từ database qua /api/chat.
// Trình duyệt chỉ giữ tạm: câu đang gửi (chờ lưu) và thông báo lỗi.
type HistoryStatus = "idle" | "loading" | "ready" | "error";

async function requestChat(init?: RequestInit) {
  const res = await fetch("/api/chat", init);
  const data: { messages?: StoredMessage[]; error?: ChatErrorCode } = await res.json();
  return { ok: res.ok, data };
}

export function ChatWidget() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<StoredMessage[]>([]);
  const [historyStatus, setHistoryStatus] = React.useState<HistoryStatus>("idle");
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const sending = pending !== null;

  // Tải cuộc trò chuyện đã lưu của khách từ database, gọi khi mở khung chat lần đầu.
  function loadHistory() {
    setHistoryStatus("loading");
    requestChat()
      .then(({ ok, data }) => {
        if (!ok || !data.messages) throw new Error(data.error);
        setMessages(data.messages);
        setHistoryStatus("ready");
      })
      .catch((err: unknown) => {
        const code = err instanceof Error ? (err.message as ChatErrorCode) : undefined;
        setNotice(chatErrorMessages[code ?? "network"] ?? chatErrorMessages.network);
        setHistoryStatus("error");
      });
  }

  function toggleOpen() {
    if (!open && historyStatus === "idle") loadHistory();
    setOpen((v) => !v);
  }

  // Luôn cuộn xuống đáy khi có tin mới, đang chờ trả lời, hoặc vừa mở khung chat.
  // Cuộn tức thì (không smooth): hiệu ứng smooth bị huỷ giữa chừng khi nội dung đổi liên tiếp nên khung không xuống hết.
  React.useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, notice, historyStatus, open]);

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setPending(message);
    setNotice(null);
    setInput("");

    try {
      const { ok, data } = await requestChat({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!ok || !data.messages) throw new Error(data.error);
      // Hiển thị đúng các dòng server đã lưu vào database.
      setMessages((prev) => [...prev, ...data.messages!]);
      setHistoryStatus("ready");
    } catch (err) {
      const code = err instanceof Error ? (err.message as ChatErrorCode) : undefined;
      setNotice(chatErrorMessages[code ?? "network"] ?? chatErrorMessages.upstream_error);
      setInput(message); // chưa lưu được nên trả câu hỏi về ô nhập để khách gửi lại
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border bg-card shadow-xl shadow-black/10 ring-1 ring-foreground/6.5 sm:w-96">
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="text-sm font-medium">Hỏi đáp nhanh</p>
              <p className="text-xs opacity-80">Thường trả lời trong vài phút</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng khung chat"
              className="flex size-7 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            <Bubble from="bot">{chatGreeting}</Bubble>
            {historyStatus === "loading" && (
              <Bubble from="bot" muted>
                Đang tải cuộc trò chuyện...
              </Bubble>
            )}
            {messages.map((m) => (
              <Bubble key={m.id} from={m.from}>
                {m.text}
              </Bubble>
            ))}
            {pending && <Bubble from="user">{pending}</Bubble>}
            {sending && (
              <Bubble from="bot" muted>
                Đang trả lời...
              </Bubble>
            )}
            {notice && <Bubble from="bot">{notice}</Bubble>}
          </div>

          <div className="border-t p-3">
            <div className="flex flex-wrap gap-1.5 pb-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={sending}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground duration-150 hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi của bạn..."
                className="h-9 flex-1 rounded-full border border-input bg-transparent px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0"
                aria-label="Gửi"
                disabled={sending}
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      )}

      <button
        onClick={toggleOpen}
        aria-label={open ? "Đóng khung chat" : "Mở khung chat hỏi đáp"}
        className="ml-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-black/20 duration-150 hover:brightness-105 active:scale-95"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}

function Bubble({
  from,
  muted,
  children,
}: {
  from: "bot" | "user";
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
          from === "user"
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted",
          from === "bot" && (muted ? "text-muted-foreground" : "text-foreground"),
        )}
      >
        {children}
      </div>
    </div>
  );
}
