// Cấu hình và chuỗi dùng chung cho chatbot, dùng ở cả client (chat-widget) và server (api/chat).

export interface ChatMessage {
  from: "bot" | "user";
  text: string;
}

/** Tin nhắn đã lưu trong database, trả về cho widget để hiển thị. */
export interface StoredMessage extends ChatMessage {
  id: number;
  createdAt: string;
}

export const chatLimits = {
  /** Số tin nhắn gần nhất tải về để hiển thị khi mở lại khung chat. */
  maxDisplayMessages: 100,
  /** Số tin nhắn gần nhất được gửi cho model. */
  maxHistory: 20,
  /** Độ dài tối đa của một tin nhắn (ký tự). */
  maxMessageLength: 1000,
  /** Tổng độ dài lịch sử gửi cho model (ký tự); vượt thì bỏ tin cũ nhất. */
  maxTotalLength: 6000,
  /** Số lần gọi Gemini tối đa khi gặp 503 (quá tải). */
  maxAttempts: 3,
  retryBaseMs: 600,
};

export type ChatErrorCode =
  | "not_configured"
  | "bad_request"
  | "rate_limited"
  | "upstream_busy"
  | "upstream_error"
  | "storage_error";

// Server chỉ trả mã lỗi; client tra thông điệp ở đây. Song ngữ vì lỗi xảy ra trước khi biết ngôn ngữ người dùng.
export const chatErrorMessages: Record<ChatErrorCode | "network", string> = {
  not_configured:
    "Chatbot chưa được cấu hình, bạn vui lòng quay lại sau. / The chatbot is not configured yet, please come back later.",
  bad_request:
    "Tin nhắn chưa hợp lệ, bạn thử gửi lại nhé. / That message could not be processed, please try again.",
  rate_limited:
    "Bạn gửi hơi nhanh, vui lòng đợi một lát rồi thử lại. / You're sending messages too fast, please wait a moment.",
  upstream_busy:
    "Trợ lý đang bận, bạn thử lại sau ít phút nhé. / The assistant is busy, please try again in a few minutes.",
  upstream_error:
    "Trợ lý gặp sự cố, bạn thử lại sau nhé. / The assistant ran into a problem, please try again later.",
  storage_error:
    "Chưa lưu được cuộc trò chuyện, bạn thử gửi lại nhé. / We couldn't save the conversation, please try again.",
  network:
    "Có lỗi kết nối, bạn thử lại sau nhé. / Connection error, please try again later.",
};

export const chatGreeting =
  "Chào bạn! Mình là trợ lý ảo của DuHoc24, bạn cần hỗ trợ gì về hồ sơ du học?";
