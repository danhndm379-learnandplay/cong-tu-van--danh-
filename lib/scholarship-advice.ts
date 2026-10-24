// Kiểu dữ liệu và bộ kiểm tra cho "gợi ý học bổng" do AI tạo. File thuần (không import gì) nên dùng được ở cả server lẫn client.

export interface AdviceItem {
  scholarshipId: string;
  school: string;
  country: string;
  /** Tên học bổng. */
  name: string;
  /** Điều kiện tối thiểu, lấy từ database (không phải lời AI). */
  condition: string;
  /** Mức hỗ trợ, lấy từ database (không phải lời AI). */
  support: string;
  /** AI kết luận học viên có đủ điều kiện tối thiểu của học bổng này hay không. */
  eligible: boolean;
  /** Lý do do AI viết, kèm số liệu hồ sơ. */
  reason: string;
}

export interface ScholarshipAdvice {
  /** Tổng kết ngắn do AI viết. */
  summary: string;
  items: AdviceItem[];
  /** Các lần AI gọi công cụ tra cứu: AI hỏi trường nào và tìm thấy bao nhiêu học bổng (để kiểm chứng AI đã tra cứu những gì). */
  lookups: { schoolName: string; found: number }[];
  model: string;
}

const isString = (v: unknown): v is string => typeof v === "string";

/** Đọc lại gợi ý đã lưu trong jsonb; trả null nếu dữ liệu không đúng dạng (không tin dữ liệu lưu trữ một cách mù quáng). */
export function parseStoredAdvice(raw: unknown): ScholarshipAdvice | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!isString(r.summary) || !Array.isArray(r.items) || !Array.isArray(r.lookups) || !isString(r.model)) return null;

  const items: AdviceItem[] = [];
  for (const it of r.items) {
    if (!it || typeof it !== "object") return null;
    const i = it as Record<string, unknown>;
    if (
      !isString(i.scholarshipId) ||
      !isString(i.school) ||
      !isString(i.country) ||
      !isString(i.name) ||
      !isString(i.condition) ||
      !isString(i.support) ||
      typeof i.eligible !== "boolean" ||
      !isString(i.reason)
    ) {
      return null;
    }
    items.push({
      scholarshipId: i.scholarshipId,
      school: i.school,
      country: i.country,
      name: i.name,
      condition: i.condition,
      support: i.support,
      eligible: i.eligible,
      reason: i.reason,
    });
  }

  const lookups: ScholarshipAdvice["lookups"] = [];
  for (const l of r.lookups) {
    if (!l || typeof l !== "object") return null;
    const x = l as Record<string, unknown>;
    if (!isString(x.schoolName) || typeof x.found !== "number") return null;
    lookups.push({ schoolName: x.schoolName, found: x.found });
  }

  return { summary: r.summary, items, lookups, model: r.model };
}
