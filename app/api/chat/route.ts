import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { cookies } from "next/headers";
import {
  appendTurn,
  findLatestConversationId,
  hashVisitorToken,
  isValidVisitorToken,
  listMessages,
  newVisitorToken,
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/lib/chat-store";
import {
  chatLimits,
  type ChatErrorCode,
  type ChatMessage,
  type StoredMessage,
} from "@/lib/chatbot-config";
import { systemInstruction } from "@/lib/chatbot-prompt";
import { checkRateLimit } from "@/lib/rate-limit";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";
// Mức "suy nghĩ" của model: MINIMAL nhanh nhất; tăng lên LOW/MEDIUM/HIGH nếu cần hiểu câu hỏi tốt hơn.
const THINKING_LEVEL =
  Object.values(ThinkingLevel).find((v) => v === process.env.GEMINI_THINKING_LEVEL?.toUpperCase()) ??
  ThinkingLevel.MINIMAL;
const RATE_LIMIT_PER_IP = Number(process.env.CHAT_RATE_LIMIT_PER_MIN) || 10;
// Gói miễn phí của Gemini chỉ cho 15 request/phút/model; giữ mặc định thấp hơn để không đụng 429 từ Google.
// Nâng lên khi dùng gói trả phí.
const RATE_LIMIT_GLOBAL = Number(process.env.CHAT_GLOBAL_RATE_LIMIT_PER_MIN) || 12;

// Model lite hay chép nguyên đáp án tiếng Việt từ bộ QnA. Ép model khai báo ngôn ngữ người dùng trước
// (trường user_language đứng trước reply trong schema) rồi mới viết câu trả lời bằng ngôn ngữ đó;
// cách này không giới hạn ở ngôn ngữ nào và không cần dò ngôn ngữ bằng code.
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    user_language: {
      type: Type.STRING,
      description:
        "Name, in English, of the language the latest user message is written in (e.g. English, Vietnamese, Japanese). Use Vietnamese if unclear.",
    },
    reply: {
      type: Type.STRING,
      description:
        "The reply, written ENTIRELY in user_language, translating the Vietnamese source content (Q&A answers, service info) when needed.",
    },
  },
  required: ["user_language", "reply"],
  propertyOrdering: ["user_language", "reply"],
};

function errorResponse(code: ChatErrorCode, status: number, headers?: HeadersInit) {
  return Response.json({ error: code }, { status, headers });
}

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}

type Turn = { role: "user" | "model"; text: string };

// Chuẩn hoá lịch sử (đọc từ database + câu mới của khách): cắt độ dài, bắt đầu bằng lượt user, gộp lượt liên tiếp cùng vai trò,
// giới hạn tổng độ dài, và kết thúc bằng lượt user. Trả về null nếu không còn gì hợp lệ.
function normalizeHistory(messages: ChatMessage[]): Turn[] | null {
  const turns: Turn[] = [];
  for (const m of messages) {
    const text = m.text.trim().slice(0, chatLimits.maxMessageLength);
    if (!text) continue;
    const role = m.from === "user" ? "user" : "model";
    const last = turns[turns.length - 1];
    if (last?.role === role) last.text += `\n${text}`;
    else turns.push({ role, text });
  }

  const dropLeadingModelTurns = () => {
    while (turns[0]?.role === "model") turns.shift();
  };
  const totalLength = () => turns.reduce((sum, t) => sum + t.text.length, 0);

  dropLeadingModelTurns();
  while (turns.length > 1 && totalLength() > chatLimits.maxTotalLength) {
    turns.shift();
    dropLeadingModelTurns();
  }

  return turns.length && turns[turns.length - 1].role === "user" ? turns : null;
}

function extractReply(raw: string | undefined) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.reply === "string" ? parsed.reply.trim() : "";
  } catch {
    return raw.trim();
  }
}

const RATE_LIMIT_READ_PER_IP = 60;
const NO_STORE = { "Cache-Control": "no-store" };

/** Trả về Response 429 nếu vượt giới hạn, ngược lại null. `perIp` là số request/phút cho mỗi IP. */
function rateLimitResponse(request: Request, bucket: string, perIp: number, withGlobal: boolean) {
  const result = checkRateLimit(`${bucket}:${clientKey(request)}`, perIp);
  const final = result.ok && withGlobal ? checkRateLimit("global", RATE_LIMIT_GLOBAL) : result;
  return final.ok
    ? null
    : errorResponse("rate_limited", 429, { "Retry-After": String(final.retryAfterSec) });
}

type GeminiResult = { ok: true; text: string } | { ok: false; code: ChatErrorCode };

async function askGemini(apiKey: string, history: Turn[]): Promise<GeminiResult> {
  const ai = new GoogleGenAI({ apiKey });
  const generateRequest = {
    model: MODEL,
    contents: history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    config: {
      systemInstruction,
      temperature: 0, // trả lời bám sát bộ QnA, hạn chế model "sáng tạo" thêm
      responseMimeType: "application/json",
      responseSchema,
      thinkingConfig: { thinkingLevel: THINKING_LEVEL },
    },
  };

  // Gemini thỉnh thoảng trả 503 khi quá tải; thử lại vài lần, nghỉ ngắn giữa các lần.
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await ai.models.generateContent(generateRequest);
      const text = extractReply(response.text);
      if (!text) throw new Error("empty response");
      return { ok: true, text };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 503 && attempt < chatLimits.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, chatLimits.retryBaseMs * attempt));
        continue;
      }
      console.error("[api/chat] Gemini error:", err);
      return { ok: false, code: status === 503 || status === 429 ? "upstream_busy" : "upstream_error" };
    }
  }
}

// GET: trả lại cuộc trò chuyện gần nhất của khách (nhận diện bằng cookie httpOnly), đọc từ database.
export async function GET(request: Request) {
  const limited = rateLimitResponse(request, "read", RATE_LIMIT_READ_PER_IP, false);
  if (limited) return limited;

  try {
    const token = (await cookies()).get(VISITOR_COOKIE)?.value;
    if (!isValidVisitorToken(token)) return Response.json({ messages: [] }, { headers: NO_STORE });

    const conversationId = await findLatestConversationId(hashVisitorToken(token));
    const messages = conversationId ? await listMessages(conversationId) : [];
    return Response.json({ messages }, { headers: NO_STORE });
  } catch (err) {
    console.error("[api/chat] Storage error (GET):", err);
    return errorResponse("storage_error", 500);
  }
}

// POST: nhận MỘT câu hỏi của khách; lịch sử lấy từ database (không tin lịch sử do trình duyệt gửi),
// gọi Gemini, lưu cả câu hỏi và câu trả lời vào database rồi trả lại đúng các dòng đã lưu.
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return errorResponse("not_configured", 500);

  const limited = rateLimitResponse(request, "ip", RATE_LIMIT_PER_IP, true);
  if (limited) return limited;

  let message = "";
  try {
    const body = await request.json();
    if (typeof body?.message === "string") {
      message = body.message.trim().slice(0, chatLimits.maxMessageLength);
    }
  } catch {
    // body không phải JSON hợp lệ: xử lý như thiếu message bên dưới
  }
  if (!message) return errorResponse("bad_request", 400);

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(VISITOR_COOKIE)?.value;
  const token = isValidVisitorToken(existingToken) ? existingToken : newVisitorToken();
  const visitorHash = hashVisitorToken(token);

  let conversationId: string | null = null;
  let past: StoredMessage[] = [];
  try {
    if (token === existingToken) {
      conversationId = await findLatestConversationId(visitorHash);
      if (conversationId) past = await listMessages(conversationId, chatLimits.maxHistory);
    }
  } catch (err) {
    console.error("[api/chat] Storage error (load history):", err);
    return errorResponse("storage_error", 500);
  }

  const history = normalizeHistory([...past, { from: "user", text: message }]);
  if (!history) return errorResponse("bad_request", 400);

  const reply = await askGemini(apiKey, history);
  if (!reply.ok) return errorResponse(reply.code, 502);

  let saved: StoredMessage[];
  try {
    saved = await appendTurn(visitorHash, conversationId, message, reply.text.slice(0, 4000));
  } catch (err) {
    console.error("[api/chat] Storage error (save):", err);
    return errorResponse("storage_error", 500);
  }

  cookieStore.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_COOKIE_MAX_AGE,
  });
  return Response.json({ messages: saved }, { headers: NO_STORE });
}
