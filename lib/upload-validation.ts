// Kiểm tra file học viên tải lên TRƯỚC khi gửi cho Gemini: không rỗng, không quá lớn, đúng định dạng cho loại giấy tờ.
// Định dạng thật được nhận diện bằng "chữ ký" (magic bytes) ở đầu file, KHÔNG tin tên file hay Content-Type do trình duyệt khai.
// Logic thuần (chỉ import type), test trực tiếp bằng Node.
import type { DocType } from "./portal-docs";

/** Vercel giới hạn body request ~4.5 MB; mỗi file gửi riêng một request nên để 4 MB. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type DetectedFormat = "pdf" | "jpeg" | "png" | "webp" | "unknown";

export const FORMAT_MIME: Record<Exclude<DetectedFormat, "unknown">, string> = {
  pdf: "application/pdf",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Bảng điểm chỉ nhận PDF; chứng chỉ IELTS và CMND/hộ chiếu chỉ nhận ảnh. */
export const ALLOWED_FORMATS: Record<DocType, readonly DetectedFormat[]> = {
  transcript: ["pdf"],
  ielts: ["jpeg", "png", "webp"],
  identity: ["jpeg", "png", "webp"],
};

const EXPECTED_TEXT: Record<DocType, string> = {
  transcript: "PDF",
  ielts: "ảnh JPG, PNG hoặc WebP",
  identity: "ảnh JPG, PNG hoặc WebP",
};

const DETECTED_TEXT: Record<DetectedFormat, string> = {
  pdf: "PDF",
  jpeg: "ảnh JPG",
  png: "ảnh PNG",
  webp: "ảnh WebP",
  unknown: "định dạng không nhận ra (file có thể bị hỏng hoặc không phải ảnh/PDF)",
};

export function detectFormat(bytes: Uint8Array): DetectedFormat {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 5 && startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf"; // %PDF-
  if (bytes.length >= 3 && startsWith([0xff, 0xd8, 0xff])) return "jpeg";
  if (bytes.length >= 8 && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (bytes.length >= 12 && startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "webp"; // RIFF....WEBP
  }
  return "unknown";
}

export type UploadErrorCode = "empty_file" | "too_large" | "wrong_format";

export type UploadCheck =
  | { ok: true; format: Exclude<DetectedFormat, "unknown">; mimeType: string }
  | { ok: false; code: UploadErrorCode; message: string };

/**
 * `size`: dung lượng khai báo (byte) của file; `head`: một đoạn đầu file (vài chục byte là đủ).
 * Kiểm tra dung lượng trước nên file quá lớn bị từ chối mà không cần đọc nội dung.
 */
export function checkUpload(type: DocType, docLabel: string, size: number, head: Uint8Array): UploadCheck {
  if (size <= 0) {
    return {
      ok: false,
      code: "empty_file",
      message: `File rỗng (0 byte), có thể bị lỗi khi chọn file. Hãy chọn lại file ${docLabel} rồi nộp lại.`,
    };
  }
  if (size > MAX_UPLOAD_BYTES) {
    const mb = (size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      code: "too_large",
      message: `File quá lớn (${mb} MB), tối đa ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Hãy nén PDF hoặc chụp ảnh ở độ phân giải thấp hơn rồi nộp lại.`,
    };
  }
  const format = detectFormat(head);
  if (format === "unknown" || !ALLOWED_FORMATS[type].includes(format)) {
    return {
      ok: false,
      code: "wrong_format",
      message: `Sai định dạng: ${docLabel} cần file ${EXPECTED_TEXT[type]}, nhưng file này là ${DETECTED_TEXT[format]}. Hãy chọn đúng file rồi nộp lại.`,
    };
  }
  return { ok: true, format, mimeType: FORMAT_MIME[format] };
}
