// Xuất lead ra CSV. File thuần (không import gì) để test được trực tiếp bằng Node.
//
// - Thêm BOM UTF-8 để Excel đọc đúng tiếng Việt; xuống dòng CRLF theo RFC 4180.
// - Chống CSV/formula injection: dữ liệu do KHÁCH nhập (tên, ghi chú...) có thể bắt đầu bằng = + - @ và bị Excel/Sheets
//   chạy như công thức khi admin mở file, nên ô nguy hiểm được chèn thêm dấu nháy đơn ở đầu.

export interface LeadCsvRow {
  conversationId: string;
  conversationStartedAt: string;
  lastMessageAt: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  studyCountry: string | null;
  educationLevel: string | null;
  major: string | null;
  availability: string | null;
  wantsConsultation: boolean | null;
  note: string | null;
  quality: string;
  qualityReason: string | null;
  extractedAt: string;
}

const HEADERS = [
  "Mã cuộc trò chuyện",
  "Bắt đầu",
  "Hoạt động gần nhất",
  "Tên",
  "Email",
  "Số điện thoại",
  "Nước du học",
  "Bậc học",
  "Ngành",
  "Thời gian rảnh",
  "Đặt lịch tư vấn",
  "Ghi chú",
  "Chất lượng",
  "Lý do đánh giá",
  "Trích xuất lúc",
];

// Số điện thoại hợp lệ có thể bắt đầu bằng + hoặc -, không phải công thức nên không cần chèn dấu nháy.
const PHONE_LIKE = /^[+-]?[\d\s().-]+$/;

export function csvCell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=@\t\r]/.test(text) || (/^[+-]/.test(text) && !PHONE_LIKE.test(text))) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const consultationLabel = (v: boolean | null) => (v === true ? "Có" : v === false ? "Không" : "");

export function leadsToCsv(rows: LeadCsvRow[]): string {
  const lines = [HEADERS.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.conversationId,
        r.conversationStartedAt,
        r.lastMessageAt,
        r.name,
        r.email,
        r.phone,
        r.studyCountry,
        r.educationLevel,
        r.major,
        r.availability,
        consultationLabel(r.wantsConsultation),
        r.note,
        r.quality,
        r.qualityReason,
        r.extractedAt,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
