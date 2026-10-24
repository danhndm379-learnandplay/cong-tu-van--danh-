// Định dạng hiển thị điều kiện và mức hỗ trợ của học bổng từ dữ liệu có cấu trúc trong bảng `scholarships`.
// Dùng chung cho công cụ tra cứu của AI (để AI đọc cùng chữ với người dùng) và giao diện. Logic thuần, test trực tiếp bằng Node.

export type ConditionMetric = "gpa" | "ielts";
export type SupportType = "percent" | "full";

const score = (n: number) => n.toFixed(2).replace(/0$/, "");

/** "Điểm học tập từ 8.0 (thang 10)" hoặc "IELTS từ 7.0". */
export function conditionText(metric: ConditionMetric, min: number): string {
  return metric === "gpa" ? `Điểm học tập từ ${score(min)} (thang 10)` : `IELTS từ ${score(min)}`;
}

/** "Hỗ trợ 25% học phí" hoặc "Hỗ trợ toàn phần". */
export function supportText(type: SupportType, percent: number | null): string {
  if (type === "full") return "Hỗ trợ toàn phần";
  return `Hỗ trợ ${percent === null ? "?" : Number(percent.toFixed(2))}% học phí`;
}

/** Bỏ dấu, hạ chữ thường, gộp khoảng trắng: để khớp tên trường người/AI gõ ("dai hoc deakin" = "Đại học Deakin"). */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Tên tra cứu có khớp tên trường không: bằng nhau, hoặc cái này chứa cái kia (sau khi chuẩn hoá). */
export function schoolNameMatches(schoolName: string, query: string): boolean {
  const a = normalizeName(schoolName);
  const b = normalizeName(query);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
