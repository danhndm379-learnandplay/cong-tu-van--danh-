import { cookies } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { DocExtractionError, extractDocument } from "@/lib/document-extraction";
import { DOC_SHORT_NAMES, DOC_TYPES, evaluateDocument, type DocType } from "@/lib/portal-docs";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getOrCreateStudentProfile,
  hashStudentToken,
  isValidStudentToken,
  newStudentToken,
  saveStudentDocument,
  STUDENT_COOKIE,
  STUDENT_COOKIE_MAX_AGE,
} from "@/lib/student-store";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/upload-validation";

// Nhận MỘT giấy tờ của học viên (multipart: `type` + `file`), kiểm tra, cho Gemini đọc, lưu thông tin trích xuất vào hồ sơ.
// Mỗi file một request để không vượt giới hạn body ~4.5 MB của Vercel. Đọc bằng AI có thể mất vài giây nên nới thời gian chạy.
export const maxDuration = 60;

const UPLOAD_LIMIT_PER_IP = 8;
const UPLOAD_LIMIT_GLOBAL = 12;
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json({ ok: false, error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const perIp = checkRateLimit(`doc-ip:${ip}`, UPLOAD_LIMIT_PER_IP);
  const limited = perIp.ok ? checkRateLimit("doc-global", UPLOAD_LIMIT_GLOBAL) : perIp;
  if (!limited.ok) {
    return fail("rate_limited", `Bạn nộp hơi nhanh, vui lòng đợi ${limited.retryAfterSec} giây rồi thử lại.`, 429, {
      "Retry-After": String(limited.retryAfterSec),
    });
  }

  // Từ chối sớm nếu request đã quá lớn, tránh đọc cả body vào bộ nhớ.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 256 * 1024) {
    return fail(
      "too_large",
      `File quá lớn (${(declared / (1024 * 1024)).toFixed(1)} MB), tối đa ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB. Hãy nén PDF hoặc chụp ảnh ở độ phân giải thấp hơn rồi nộp lại.`,
      413,
    );
  }

  let type: DocType;
  let file: File;
  try {
    const form = await request.formData();
    const rawType = form.get("type");
    const rawFile = form.get("file");
    if (typeof rawType !== "string" || !DOC_TYPES.includes(rawType as DocType)) {
      return fail("invalid_type", "Loại giấy tờ không hợp lệ.", 400);
    }
    if (!(rawFile instanceof File)) return fail("no_file", "Bạn chưa chọn file để nộp.", 400);
    type = rawType as DocType;
    file = rawFile;
  } catch {
    return fail("bad_request", "Không đọc được dữ liệu tải lên, bạn thử chọn lại file và nộp lại.", 400);
  }

  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const check = checkUpload(type, DOC_SHORT_NAMES[type], file.size, head);
  if (!check.ok) return fail(check.code, check.message, 400);

  let extraction;
  try {
    extraction = await extractDocument(type, new Uint8Array(await file.arrayBuffer()), check.mimeType);
  } catch (err) {
    const code = err instanceof DocExtractionError ? err.code : "upstream_error";
    if (code === "not_configured") return fail(code, "Hệ thống chưa được cấu hình để đọc giấy tờ.", 500);
    if (code === "upstream_busy") {
      return fail(
        code,
        "Hệ thống đọc giấy tờ đang bận hoặc hết hạn mức. Bạn thử lại sau ít phút (file của bạn chưa bị coi là không hợp lệ).",
        503,
      );
    }
    console.error("[api/portal/documents] Đọc giấy tờ thất bại:", err);
    return fail(
      code,
      "Hệ thống chưa đọc được file lúc này (lỗi phía hệ thống, không phải do file của bạn). Bạn thử lại sau ít phút.",
      502,
    );
  }

  const cookieStore = await cookies();
  const existing = cookieStore.get(STUDENT_COOKIE)?.value;
  const token = isValidStudentToken(existing) ? existing : newStudentToken();

  try {
    const profileId = await getOrCreateStudentProfile(hashStudentToken(token));
    await saveStudentDocument(
      profileId,
      type,
      { name: file.name || `${type}`, mimeType: check.mimeType, size: file.size },
      extraction.fields,
      extraction.model,
    );
  } catch (err) {
    console.error("[api/portal/documents] Lưu hồ sơ thất bại:", err);
    return fail("storage_error", "Đã đọc xong nhưng chưa lưu được vào hồ sơ, bạn thử nộp lại.", 500);
  }

  cookieStore.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STUDENT_COOKIE_MAX_AGE,
  });

  const evaluation = evaluateDocument(type, extraction.fields);
  return Response.json(
    { ok: true, type, status: evaluation.status, problems: evaluation.problems, fields: extraction.fields },
    { headers: NO_STORE },
  );
}
