import "server-only";

import {
  DOC_TYPES,
  evaluateProfile,
  type DocFields,
  type DocType,
  type ProfileEvaluation,
} from "@/lib/portal-docs";
import { matchSchools, gpaOnScale10, type SchoolMatchResult, type StudentScores } from "@/lib/school-match";
import { adviceInputHash, type AdvisorStudent } from "@/lib/scholarship-advisor";
import { parseStoredAdvice, type ScholarshipAdvice } from "@/lib/scholarship-advice";
import { listSchools, listScholarships, type ScholarshipWithSchool } from "@/lib/school-store";
import type { StudentSnapshot } from "@/lib/student-store";

// Tổng hợp kết quả cho trang cổng hồ sơ và các route liên quan, theo thứ tự:
//   1) kiểm tra đủ/thiếu/hợp lệ (code thường)  →  2) so sánh điểm chuẩn từng trường (phép so sánh số, code thường)
//   →  3) chuẩn bị đầu vào cho AI gợi ý học bổng (function calling).
// Bước 2 và 3 chỉ chạy khi hồ sơ đã đủ và hợp lệ.

export interface PortalResults {
  evaluation: ProfileEvaluation;
  scores: StudentScores | null;
  matches: SchoolMatchResult[] | null;
}

export function documentFields(snapshot: StudentSnapshot): Partial<Record<DocType, DocFields>> {
  const out: Partial<Record<DocType, DocFields>> = {};
  for (const type of DOC_TYPES) {
    const doc = snapshot.documents[type];
    if (doc) out[type] = doc.fields;
  }
  return out;
}

export async function computePortalResults(snapshot: StudentSnapshot): Promise<PortalResults> {
  const evaluation = evaluateProfile(documentFields(snapshot));
  if (!evaluation.complete) return { evaluation, scores: null, matches: null };

  const transcript = snapshot.documents.transcript!.fields;
  const ielts = snapshot.documents.ielts!.fields;
  const scores: StudentScores = { gpa: transcript.gpa!, gpaScale: transcript.gpaScale!, ielts: ielts.overall! };
  const matches = matchSchools(scores, await listSchools());
  return { evaluation, scores, matches };
}

export interface AdviceContext {
  student: AdvisorStudent;
  passed: { name: string; country: string }[];
  scholarships: ScholarshipWithSchool[];
  inputHash: string;
  /** Gợi ý đã lưu, chỉ có khi còn khớp đầu vào hiện tại (cùng hồ sơ, cùng trường đạt, cùng dữ liệu học bổng). */
  cached: ScholarshipAdvice | null;
}

/** Chuẩn bị đầu vào cho AI gợi ý học bổng; null nếu chưa có trường nào đạt (không có gì để tra cứu). */
export async function buildAdviceContext(snapshot: StudentSnapshot, results: PortalResults): Promise<AdviceContext | null> {
  if (!results.scores || !results.matches) return null;
  const passed = results.matches.filter((m) => m.passed).map((m) => ({ name: m.school.name, country: m.school.country }));
  if (passed.length === 0) return null;

  const i = snapshot.documents.ielts!.fields;
  const student: AdvisorStudent = {
    gpa10: gpaOnScale10(results.scores.gpa, results.scores.gpaScale),
    gpaPrinted: results.scores.gpa,
    gpaScale: results.scores.gpaScale,
    ielts: { overall: i.overall!, listening: i.listening!, reading: i.reading!, writing: i.writing!, speaking: i.speaking! },
  };
  const scholarships = await listScholarships();
  const inputHash = adviceInputHash(student, passed, scholarships);
  const cached = snapshot.scholarship?.inputHash === inputHash ? parseStoredAdvice(snapshot.scholarship.suggestions) : null;
  return { student, passed, scholarships, inputHash, cached };
}
