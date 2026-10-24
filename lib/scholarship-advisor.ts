import "server-only";

import { createHash } from "node:crypto";
import { GoogleGenAI, ThinkingLevel, Type, type Content, type Part } from "@google/genai";
import type { AdviceItem, ScholarshipAdvice } from "@/lib/scholarship-advice";
import { conditionText, schoolNameMatches, supportText } from "@/lib/scholarship-format";
import type { ScholarshipWithSchool } from "@/lib/school-store";

// GỢI Ý HỌC BỔNG bằng FUNCTION CALLING của Gemini.
// - Ta chỉ đưa cho AI MỘT công cụ `search_scholarships(school_name)` để tra cứu học bổng của một trường.
// - AI TỰ QUYẾT ĐỊNH cần tra cứu trường nào (trong danh sách trường học viên đã đạt) và TỰ so sánh điều kiện học bổng với
//   hồ sơ để kết luận đủ điều kiện hay không. Code KHÔNG chứa luật so sánh điều kiện học bổng.
// - Code chỉ: thực thi công cụ (đọc dữ liệu học bổng), kiểm tra kết quả cuối (học bổng AI nhắc tới phải có thật trong dữ liệu
//   công cụ trả về) và hiển thị điều kiện/mức hỗ trợ lấy từ database để người dùng kiểm chứng lại lời AI.
// - Chỉ gửi cho AI các con số học tập (không gửi họ tên, ngày sinh, số giấy tờ).

export const ADVISOR_MODEL = process.env.GEMINI_ADVISOR_MODEL ?? "gemini-3.1-flash-lite";
const THINKING_LEVEL =
  Object.values(ThinkingLevel).find((v) => v === process.env.GEMINI_ADVISOR_THINKING_LEVEL?.toUpperCase()) ??
  ThinkingLevel.LOW;

const MAX_ROUNDS = 5;
const MAX_TOOL_CALLS = 12;
const MAX_ATTEMPTS = 3;
const PROMPT_VERSION = "v1";

export interface AdvisorStudent {
  /** Điểm học tập đã quy đổi về thang 10. */
  gpa10: number;
  /** Điểm tổng kết như in trên bảng điểm. */
  gpaPrinted: number;
  gpaScale: number;
  ielts: { overall: number; listening: number; reading: number; writing: number; speaking: number };
}

export interface AdvisorSchool {
  name: string;
  country: string;
}

export type AdvisorErrorCode = "not_configured" | "upstream_busy" | "upstream_error" | "invalid_output";

export class AdvisorError extends Error {
  constructor(
    public readonly code: AdvisorErrorCode,
    cause?: unknown,
  ) {
    super(`Scholarship advisor failed: ${code}`, { cause });
    this.name = "AdvisorError";
  }
}

/** Dấu vân tay đầu vào: đổi hồ sơ, danh sách trường đạt hoặc dữ liệu học bổng thì gợi ý cũ không còn đúng và phải tạo lại. */
export function adviceInputHash(
  student: AdvisorStudent,
  passed: AdvisorSchool[],
  scholarships: ScholarshipWithSchool[],
): string {
  const payload = {
    v: PROMPT_VERSION,
    model: ADVISOR_MODEL,
    student,
    passed: passed.map((s) => s.name).sort(),
    scholarships: scholarships.map((s) => [s.id, s.name, s.schoolName, s.conditionMetric, s.conditionMin, s.supportType, s.supportPercent]).sort(),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

const searchScholarshipsDeclaration = {
  name: "search_scholarships",
  description:
    "Tra cứu trong cơ sở dữ liệu các học bổng của MỘT trường. Trả về tên học bổng, điều kiện tối thiểu (chỉ tiêu và ngưỡng) và mức hỗ trợ.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      school_name: { type: Type.STRING, description: "Tên trường cần tra cứu, ví dụ: 'Đại học Deakin'." },
    },
    required: ["school_name"],
  },
};

const finalSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Tổng kết 2-3 câu tiếng Việt: học bổng nào học viên đủ điều kiện, học bổng nào chưa và vì sao.",
    },
    recommendations: {
      type: Type.ARRAY,
      description: "Đánh giá từng học bổng mà bạn đã tra cứu được.",
      items: {
        type: Type.OBJECT,
        properties: {
          scholarship_id: { type: Type.STRING, description: "Đúng giá trị `id` do công cụ trả về." },
          eligible: { type: Type.BOOLEAN, description: "true nếu hồ sơ đáp ứng điều kiện tối thiểu của học bổng này." },
          reason: { type: Type.STRING, description: "Lý do ngắn bằng tiếng Việt, nêu số liệu cụ thể của hồ sơ so với điều kiện." },
        },
        required: ["scholarship_id", "eligible", "reason"],
      },
    },
  },
  required: ["summary", "recommendations"],
};

const SYSTEM_INSTRUCTION = `Bạn là cố vấn học bổng của DuHoc24. Nhiệm vụ: dựa trên hồ sơ học viên và danh sách các trường học viên ĐÃ ĐẠT yêu cầu đầu vào, tìm và gợi ý học bổng phù hợp.

CÁCH LÀM:
- Dùng công cụ search_scholarships để tra cứu học bổng của từng trường. Chính bạn quyết định cần tra cứu trường nào; chỉ tra cứu các trường nằm trong danh sách học viên đã đạt.
- Với mỗi học bổng tìm được, tự so sánh điều kiện tối thiểu của học bổng với số liệu hồ sơ rồi kết luận học viên có đáp ứng điều kiện tối thiểu hay không (eligible), kèm lý do ngắn nêu số liệu cụ thể.
- Chỉ nhắc đến học bổng do công cụ trả về và dùng đúng scholarship_id đó. Không bịa học bổng, điều kiện hay mức hỗ trợ.
- Điểm học tập luôn so sánh theo thang 10 (dùng số đã quy đổi trong hồ sơ). IELTS so sánh với điểm Overall.
- Đáp ứng điều kiện tối thiểu KHÔNG đảm bảo nhận được học bổng (nhà trường quyết định). Không hứa hẹn kết quả.
- Viết bằng tiếng Việt, ngắn gọn.`;

const fmt = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

function studentPrompt(student: AdvisorStudent, passed: AdvisorSchool[]): string {
  const i = student.ielts;
  const gpa =
    student.gpaScale === 10
      ? `${fmt(student.gpaPrinted)}/10`
      : `${fmt(student.gpaPrinted)}/${student.gpaScale} (quy đổi tuyến tính về thang 10 được ${fmt(student.gpa10)})`;
  return `HỒ SƠ HỌC VIÊN:
- Điểm học tập tổng kết: ${gpa}. Điểm theo thang 10 dùng để so sánh: ${fmt(student.gpa10)}.
- IELTS Overall: ${fmt(i.overall)} (Nghe ${fmt(i.listening)}, Đọc ${fmt(i.reading)}, Viết ${fmt(i.writing)}, Nói ${fmt(i.speaking)}).

CÁC TRƯỜNG HỌC VIÊN ĐÃ ĐẠT YÊU CẦU:
${passed.map((s) => `- ${s.name} (${s.country})`).join("\n")}

Hãy tra cứu học bổng của các trường trên và gợi ý học bổng phù hợp.`;
}

/** Thực thi công cụ search_scholarships trên dữ liệu học bổng đã đọc từ database. */
function runSearchTool(args: unknown, scholarships: ScholarshipWithSchool[]) {
  const schoolName =
    args && typeof args === "object" && typeof (args as Record<string, unknown>).school_name === "string"
      ? ((args as Record<string, string>).school_name as string).slice(0, 200)
      : "";
  if (!schoolName.trim()) return { schoolName, found: [] as ScholarshipWithSchool[], response: { error: "Thiếu tham số school_name." } };

  const found = scholarships.filter((s) => schoolNameMatches(s.schoolName, schoolName));
  if (found.length === 0) {
    return {
      schoolName,
      found,
      response: { school: schoolName, scholarships: [], note: `Không có học bổng nào trong dữ liệu cho trường "${schoolName}".` },
    };
  }
  return {
    schoolName,
    found,
    response: {
      school: found[0].schoolName,
      country: found[0].country,
      scholarships: found.map((s) => ({
        id: s.id,
        name: s.name,
        condition: conditionText(s.conditionMetric, s.conditionMin),
        support: supportText(s.supportType, s.supportPercent),
      })),
    },
  };
}

interface FinalRecommendation {
  scholarship_id?: unknown;
  eligible?: unknown;
  reason?: unknown;
}

/**
 * Chạy vòng lặp function calling: AI gọi công cụ tra cứu → ta trả kết quả → ... → AI trả JSON kết luận.
 * Chỉ gọi khi có ít nhất một trường đạt yêu cầu (nếu không có trường nào thì không có gì để tra cứu).
 */
export async function adviseScholarships(
  student: AdvisorStudent,
  passed: AdvisorSchool[],
  scholarships: ScholarshipWithSchool[],
): Promise<ScholarshipAdvice> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AdvisorError("not_configured");

  const ai = new GoogleGenAI({ apiKey });
  const contents: Content[] = [{ role: "user", parts: [{ text: studentPrompt(student, passed) }] }];
  const retrieved = new Map<string, ScholarshipWithSchool>();
  const lookups: ScholarshipAdvice["lookups"] = [];
  let toolCalls = 0;

  const config = {
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: [searchScholarshipsDeclaration] }],
    temperature: 0,
    responseMimeType: "application/json",
    responseSchema: finalSchema,
    thinkingConfig: { thinkingLevel: THINKING_LEVEL },
  };

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const response = await generate(ai, contents, config);
    const calls = response.functionCalls ?? [];

    if (calls.length === 0) {
      return buildAdvice(response.text ?? "", retrieved, lookups);
    }

    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) throw new AdvisorError("invalid_output");
    contents.push(modelContent); // giữ nguyên lượt gọi công cụ của model (kèm chữ ký suy luận) khi gửi lại

    const parts: Part[] = [];
    for (const call of calls) {
      toolCalls++;
      if (call.name !== "search_scholarships" || toolCalls > MAX_TOOL_CALLS) {
        parts.push({
          functionResponse: { id: call.id, name: call.name ?? "unknown", response: { error: "Công cụ không tồn tại hoặc vượt quá số lần gọi cho phép." } },
        });
        continue;
      }
      const result = runSearchTool(call.args, scholarships);
      lookups.push({ schoolName: result.schoolName, found: result.found.length });
      for (const s of result.found) retrieved.set(s.id, s);
      parts.push({ functionResponse: { id: call.id, name: call.name, response: result.response } });
    }
    contents.push({ role: "user", parts });
  }

  // Quá số vòng cho phép mà AI vẫn chưa trả kết luận.
  throw new AdvisorError("invalid_output");
}

async function generate(ai: GoogleGenAI, contents: Content[], config: object) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ai.models.generateContent({ model: ADVISOR_MODEL, contents, config });
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 503 && attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
        continue;
      }
      console.error("[scholarship-advisor] Gemini error:", err);
      throw new AdvisorError(status === 503 || status === 429 ? "upstream_busy" : "upstream_error", err);
    }
  }
}

/** Kiểm tra JSON kết luận của AI. Học bổng AI nhắc tới phải có trong dữ liệu công cụ đã trả về; điều kiện/mức hỗ trợ lấy từ database. */
function buildAdvice(
  text: string,
  retrieved: Map<string, ScholarshipWithSchool>,
  lookups: ScholarshipAdvice["lookups"],
): ScholarshipAdvice {
  let parsed: { summary?: unknown; recommendations?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new AdvisorError("invalid_output", err);
  }
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.recommendations)) {
    throw new AdvisorError("invalid_output");
  }

  const seen = new Set<string>();
  const items: AdviceItem[] = [];
  for (const rec of parsed.recommendations as FinalRecommendation[]) {
    if (typeof rec?.scholarship_id !== "string" || typeof rec.eligible !== "boolean" || typeof rec.reason !== "string") continue;
    const source = retrieved.get(rec.scholarship_id);
    if (!source || seen.has(source.id)) continue; // bỏ học bổng AI "bịa" hoặc lặp
    seen.add(source.id);
    items.push({
      scholarshipId: source.id,
      school: source.schoolName,
      country: source.country,
      name: source.name,
      condition: conditionText(source.conditionMetric, source.conditionMin),
      support: supportText(source.supportType, source.supportPercent),
      eligible: rec.eligible,
      reason: rec.reason.slice(0, 600),
    });
  }
  items.sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.school.localeCompare(b.school, "vi"));

  return { summary: parsed.summary.slice(0, 1200), items, lookups, model: ADVISOR_MODEL };
}
