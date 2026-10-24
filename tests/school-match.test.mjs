// Test so sánh điểm chuẩn bằng phép so sánh số (lib/school-match.ts), đặc biệt ở các điểm biên. Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { gpaOnScale10, matchSchools } from "../lib/school-match.ts";

const rule = (minGpa, minIelts) => ({ id: "1", name: "S", country: "C", minGpa, minIelts });
const m = (gpa, scale, ielts, minGpa, minIelts) => matchSchools({ gpa, gpaScale: scale, ielts }, [rule(minGpa, minIelts)])[0];

test("vượt cả hai điểm chuẩn thì đạt; bằng đúng ngưỡng cũng đạt (≥)", () => {
  assert.equal(m(8.2, 10, 6.5, 7.0, 6.0).passed, true);
  assert.equal(m(7.0, 10, 6.0, 7.0, 6.0).passed, true);
});

test("thiếu một chút ở một tiêu chí thì không đạt, và chỉ rõ tiêu chí nào trượt", () => {
  assert.equal(m(6.99, 10, 6.5, 7.0, 6.0).passed, false);
  const r = m(8.2, 10, 5.5, 7.0, 6.0);
  assert.deepEqual([r.passed, r.gpa.passed, r.ielts.passed], [false, true, false]);
  assert.equal(m(9, 10, 6.5, 8.5, 7.0).ielts.passed, false);
});

test("quy đổi thang điểm khác về thang 10 (tuyến tính)", () => {
  assert.equal(gpaOnScale10(3.5, 4), 8.75);
  assert.equal(m(3.5, 4, 7, 8.5, 7.0).gpa.passed, true); // 8.75 >= 8.5
  assert.equal(m(3.5, 4, 7, 9.0, 6.0).gpa.passed, false);
  assert.equal(m(3.0, 4, 7, 7.5, 6.0).gpa.passed, true); // đúng bằng 7.5
  assert.equal(m(85, 100, 7, 8.5, 6.0).gpa.passed, true);
  assert.equal(m(84.9, 100, 7, 8.5, 6.0).gpa.passed, false);
});

test("không bị sai số số thực và không làm tròn lên khi hiển thị", () => {
  assert.equal(m(7.1, 10, 6, 7.1, 6.0).gpa.passed, true);
  assert.equal(gpaOnScale10(8.2, 10), 8.2);
  assert.equal(gpaOnScale10(6.995, 10), 6.99);
});

test("điểm chuẩn thật của 4 trường với GPA 8.2 / IELTS 6.5, kết quả xác định", () => {
  const schools = [
    { id: "a", name: "Deakin", country: "Úc", minGpa: 7, minIelts: 6 },
    { id: "b", name: "Swinburne", country: "Úc", minGpa: 7, minIelts: 6 },
    { id: "c", name: "Melbourne", country: "Úc", minGpa: 8.5, minIelts: 7 },
    { id: "d", name: "Auckland", country: "NZ", minGpa: 7.5, minIelts: 6.5 },
  ];
  const student = { gpa: 8.2, gpaScale: 10, ielts: 6.5 };
  const res = matchSchools(student, schools);
  assert.deepEqual(res.map((x) => [x.school.name, x.passed]), [["Deakin", true], ["Swinburne", true], ["Melbourne", false], ["Auckland", true]]);
  assert.equal(JSON.stringify(res), JSON.stringify(matchSchools(student, schools)));
});
