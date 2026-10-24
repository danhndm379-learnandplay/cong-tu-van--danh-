// Test kiểm tra file tải lên (lib/upload-validation.ts): định dạng thật theo magic bytes, dung lượng. Chạy: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { checkUpload, detectFormat, MAX_UPLOAD_BYTES } from "../lib/upload-validation.ts";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
const TEXT = new TextEncoder().encode("this is not really a pdf, just text pretending");

test("detectFormat nhận đúng theo chữ ký đầu file", () => {
  assert.equal(detectFormat(PDF), "pdf");
  assert.equal(detectFormat(PNG), "png");
  assert.equal(detectFormat(JPEG), "jpeg");
  assert.equal(detectFormat(WEBP), "webp");
  assert.equal(detectFormat(WAV), "unknown", "RIFF nhưng không phải WebP");
  assert.equal(detectFormat(TEXT), "unknown");
  assert.equal(detectFormat(new Uint8Array(0)), "unknown");
});

test("đúng loại file cho từng giấy tờ thì hợp lệ", () => {
  assert.equal(checkUpload("transcript", "bảng điểm", 1000, PDF).ok, true);
  const ielts = checkUpload("ielts", "chứng chỉ IELTS", 1000, PNG);
  assert.deepEqual([ielts.ok, ielts.mimeType], [true, "image/png"]);
  assert.equal(checkUpload("identity", "CMND", 1000, JPEG).ok, true);
});

test("sai loại file bị từ chối kèm lý do nêu cả loại cần và loại thực tế", () => {
  const pdfAsIelts = checkUpload("ielts", "chứng chỉ IELTS", 1000, PDF);
  assert.deepEqual([pdfAsIelts.ok, pdfAsIelts.code], [false, "wrong_format"]);
  assert.ok(pdfAsIelts.message.includes("ảnh JPG, PNG hoặc WebP") && pdfAsIelts.message.includes("là PDF"));

  const pngAsTranscript = checkUpload("transcript", "bảng điểm", 1000, PNG);
  assert.equal(pngAsTranscript.code, "wrong_format");
  assert.ok(pngAsTranscript.message.includes("cần file PDF") && pngAsTranscript.message.includes("ảnh PNG"));

  const fake = checkUpload("transcript", "bảng điểm", 1000, TEXT); // file chữ đặt tên .pdf không qua mặt được
  assert.equal(fake.code, "wrong_format");
  assert.ok(fake.message.includes("hỏng"));
});

test("file rỗng và file quá lớn", () => {
  assert.equal(checkUpload("ielts", "x", 0, new Uint8Array(0)).code, "empty_file");
  const big = checkUpload("ielts", "x", 5 * 1024 * 1024, PNG);
  assert.equal(big.code, "too_large");
  assert.ok(big.message.includes("5.0 MB") && big.message.includes("4 MB"));
  assert.equal(checkUpload("ielts", "x", MAX_UPLOAD_BYTES, PNG).ok, true, "đúng 4 MB vẫn được");
  assert.equal(checkUpload("ielts", "x", MAX_UPLOAD_BYTES + 1, PNG).ok, false);
  assert.equal(checkUpload("ielts", "x", 10_000_000, new Uint8Array([1, 2, 3])).code, "too_large", "kiểm tra dung lượng trước nội dung");
});
