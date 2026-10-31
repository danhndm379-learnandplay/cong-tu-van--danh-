import { clientIp } from "@/lib/client-ip";
import { buildAdviceContext, computePortalResults } from "@/lib/portal-results";
import { checkRateLimit } from "@/lib/rate-limit";
import { AdvisorError, adviseScholarships } from "@/lib/scholarship-advisor";
import { loadStudentSnapshot, saveScholarshipSuggestions } from "@/lib/student-store";
import { getCurrentUser } from "@/lib/supabase-auth";

// Gợi ý học bổng cho học viên bằng AI (function calling), dựa trên hồ sơ đã trích xuất và các trường học viên đạt yêu cầu.
// Kết quả được lưu đệm trong hồ sơ; chỉ gọi AI lại khi hồ sơ, danh sách trường đạt hoặc dữ liệu học bổng thay đổi (hoặc `force`).
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const LIMIT_PER_IP = 4;
const LIMIT_GLOBAL = 8;

function fail(error: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json({ ok: false, error, message }, { status, headers: { ...NO_STORE, ...headers } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("unauthorized", "Bạn cần đăng nhập để xem gợi ý học bổng.", 401);

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // body trống: dùng giá trị mặc định
  }

  try {
    const snapshot = await loadStudentSnapshot(user.id);
    if (!snapshot.profileId) return fail("no_profile", "Bạn chưa nộp giấy tờ nào.", 404);

    const results = await computePortalResults(snapshot);
    if (!results.evaluation.complete) return fail("profile_incomplete", results.evaluation.headline, 409);

    const context = await buildAdviceContext(snapshot, results);
    if (!context) return Response.json({ ok: true, advice: null, reason: "no_passed_schools" }, { headers: NO_STORE });

    if (context.cached && !force) return Response.json({ ok: true, advice: context.cached, cached: true }, { headers: NO_STORE });

    // Chỉ tính giới hạn tần suất khi thật sự phải gọi AI.
    const ip = clientIp(request);
    const perIp = checkRateLimit(`advisor-ip:${ip}`, LIMIT_PER_IP);
    const limited = perIp.ok ? checkRateLimit("advisor-global", LIMIT_GLOBAL) : perIp;
    if (!limited.ok) {
      return fail("rate_limited", `Bạn thao tác hơi nhanh, vui lòng đợi ${limited.retryAfterSec} giây rồi thử lại.`, 429, {
        "Retry-After": String(limited.retryAfterSec),
      });
    }

    const advice = await adviseScholarships(context.student, context.passed, context.scholarships);
    await saveScholarshipSuggestions(user.id, snapshot.profileId, advice, context.inputHash);
    return Response.json({ ok: true, advice, cached: false }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AdvisorError) {
      if (err.code === "upstream_busy") {
        return fail("upstream_busy", "AI gợi ý học bổng đang bận hoặc hết hạn mức, bạn thử lại sau ít phút.", 503);
      }
      if (err.code === "not_configured") return fail("not_configured", "Hệ thống chưa được cấu hình để gợi ý học bổng.", 500);
      return fail(err.code, "AI chưa đưa ra được gợi ý lúc này, bạn thử lại sau.", 502);
    }
    console.error("[api/portal/scholarships] Lỗi:", err);
    return fail("internal", "Không tạo được gợi ý học bổng do lỗi hệ thống, bạn thử lại sau.", 500);
  }
}
