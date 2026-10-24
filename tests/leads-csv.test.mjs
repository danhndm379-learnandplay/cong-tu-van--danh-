// Test xuất CSV lead (lib/leads-csv.ts): escape, BOM, chống formula injection. Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, leadsToCsv } from "../lib/leads-csv.ts";

test("csvCell: escape đúng chuẩn", () => {
  assert.equal(csvCell("Trần Thị Mai"), "Trần Thị Mai");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell("a, b"), '"a, b"');
  assert.equal(csvCell('nói "xin chào"'), '"nói ""xin chào"""');
  assert.equal(csvCell("dòng 1\ndòng 2"), '"dòng 1\ndòng 2"');
});

test("csvCell: vô hiệu hoá công thức nguy hiểm do khách nhập", () => {
  assert.equal(csvCell("=SUM(1+1)"), "'=SUM(1+1)");
  assert.equal(csvCell('=HYPERLINK("http://evil.example","x")'), `"'=HYPERLINK(""http://evil.example"",""x"")"`);
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(csvCell("-2+3+cmd"), "'-2+3+cmd");
  assert.equal(csvCell("\t=1"), "'\t=1");
});

test("csvCell: số điện thoại và email không bị đổi", () => {
  assert.equal(csvCell("+84 90 123 4567"), "+84 90 123 4567");
  assert.equal(csvCell("+44 (7700) 900-123"), "+44 (7700) 900-123");
  assert.equal(csvCell("a.b@example.com"), "a.b@example.com");
});

test("leadsToCsv: BOM, 15 cột, CRLF, nhãn Có/Không", () => {
  const base = { conversationId: "id", conversationStartedAt: "", lastMessageAt: "", name: null, email: null, phone: null, studyCountry: null, educationLevel: null, major: null, availability: null, note: null, quality: "ok", qualityReason: null, extractedAt: "" };
  const csv = leadsToCsv([
    { ...base, conversationId: "id1", name: "=SUM(1+1)", wantsConsultation: true, quality: "good" },
    { ...base, conversationId: "id2", wantsConsultation: false, quality: "spam" },
  ]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 4); // tiêu đề + 2 dòng + dòng trống cuối
  assert.equal(lines[0].split(",").length, 15);
  assert.ok(lines[1].includes(",'=SUM(1+1),"));
  assert.ok(lines[1].includes(",Có,") && lines[2].includes(",Không,"));
});
