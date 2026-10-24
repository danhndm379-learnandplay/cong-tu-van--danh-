// So sánh hồ sơ học viên với điểm chuẩn từng trường bằng PHÉP SO SÁNH SỐ thường (không dùng AI), nên kết quả
// luôn xác định và kiểm tra lại được. Logic thuần: test trực tiếp bằng Node.

export interface SchoolRule {
  id: string;
  name: string;
  country: string;
  /** Điểm học tập tối thiểu, thang 10. */
  minGpa: number;
  minIelts: number;
}

export interface StudentScores {
  /** Điểm tổng kết như in trên bảng điểm. */
  gpa: number;
  /** Thang điểm tối đa của điểm đó (4, 5, 10, 100...). */
  gpaScale: number;
  /** Điểm IELTS tổng (Overall). */
  ielts: number;
}

export interface Criterion {
  required: number;
  actual: number;
  passed: boolean;
}

export interface SchoolMatchResult {
  school: SchoolRule;
  gpa: Criterion;
  ielts: Criterion;
  /** Đạt khi cả điểm học tập lẫn IELTS đều ≥ điểm chuẩn. */
  passed: boolean;
}

const hundredths = (n: number) => Math.round(n * 100);

/** Quy đổi tuyến tính về thang 10, cắt xuống 2 chữ số thập phân (không làm tròn lên) để số hiển thị không "đẹp" hơn thực tế. */
export function gpaOnScale10(gpa: number, scale: number): number {
  return Math.floor((gpa / scale) * 10 * 100 + 1e-9) / 100;
}

/**
 * gpa/scale*10 ≥ minGpa, viết lại thành so sánh số nguyên để không bị sai số số thực:
 *   gpa*100*10 ≥ minGpa*100*scale
 */
export function gpaMeetsMinimum(gpa: number, scale: number, minGpa: number): boolean {
  return hundredths(gpa) * 10 >= hundredths(minGpa) * scale;
}

export function matchSchools(student: StudentScores, schools: SchoolRule[]): SchoolMatchResult[] {
  const gpa10 = gpaOnScale10(student.gpa, student.gpaScale);
  return schools.map((school) => {
    const gpaPassed = gpaMeetsMinimum(student.gpa, student.gpaScale, school.minGpa);
    const ieltsPassed = hundredths(student.ielts) >= hundredths(school.minIelts);
    return {
      school,
      gpa: { required: school.minGpa, actual: gpa10, passed: gpaPassed },
      ielts: { required: school.minIelts, actual: student.ielts, passed: ieltsPassed },
      passed: gpaPassed && ieltsPassed,
    };
  });
}
