import "server-only";

import { createContextClient } from "@/lib/supabase-public";
import type { School } from "@/lib/mock-data";
import type { ConditionMetric, SupportType } from "@/lib/scholarship-format";

// Danh sách trường tham chiếu là dữ liệu CÔNG KHAI (bảng `schools`, RLS cho phép ai cũng đọc).
// Vì vậy đọc bằng client ẩn danh (publishable key, RLS vai trò anon) thay vì secret key: chỉ cần quyền tối thiểu.

interface SchoolRow {
  id: string;
  name: string;
  country: string;
  min_gpa: number | string;
  min_ielts: number | string;
}

/** Toàn bộ trường tham chiếu, sắp theo quốc gia rồi tên. */
export async function listSchools(): Promise<School[]> {
  const { data, error } = await createContextClient()
    .from("schools")
    .select("id, name, country, min_gpa, min_ielts")
    .order("country", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`Không đọc được danh sách trường: ${error.message}`, { cause: error });

  return ((data ?? []) as SchoolRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    country: row.country,
    // numeric có thể về dạng chuỗi tuỳ cấu hình; luôn ép về số.
    minGpa: Number(row.min_gpa),
    minIelts: Number(row.min_ielts),
  }));
}

export interface ScholarshipWithSchool {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  country: string;
  conditionMetric: ConditionMetric;
  /** Với "gpa": điểm tối thiểu thang 10; với "ielts": điểm IELTS tối thiểu. */
  conditionMin: number;
  supportType: SupportType;
  /** Phần trăm học phí hỗ trợ; null khi hỗ trợ toàn phần. */
  supportPercent: number | null;
}

interface ScholarshipRow {
  id: string;
  school_id: string;
  name: string;
  condition_metric: ConditionMetric;
  condition_min: number | string;
  support_type: SupportType;
  support_percent: number | string | null;
  schools: { name: string; country: string } | { name: string; country: string }[] | null;
}

/** Toàn bộ học bổng (công khai) kèm tên trường, sắp theo tên trường rồi tên học bổng. */
export async function listScholarships(): Promise<ScholarshipWithSchool[]> {
  const { data, error } = await createContextClient()
    .from("scholarships")
    .select("id, school_id, name, condition_metric, condition_min, support_type, support_percent, schools!inner(name, country)")
    .order("name", { ascending: true });
  if (error) throw new Error(`Không đọc được danh sách học bổng: ${error.message}`, { cause: error });

  return ((data ?? []) as unknown as ScholarshipRow[])
    .map((row) => {
      const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
      return {
        id: row.id,
        name: row.name,
        schoolId: row.school_id,
        schoolName: school?.name ?? "",
        country: school?.country ?? "",
        conditionMetric: row.condition_metric,
        conditionMin: Number(row.condition_min),
        supportType: row.support_type,
        supportPercent: row.support_percent === null ? null : Number(row.support_percent),
      };
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName, "vi") || a.name.localeCompare(b.name, "vi"));
}
