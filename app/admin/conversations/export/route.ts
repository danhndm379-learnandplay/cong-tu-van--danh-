import { checkStaffRead } from "@/lib/admin-guard";
import { formatDateTime } from "@/lib/format";
import { parseQualityFilter } from "@/lib/lead-sanitize";
import { leadsToCsv } from "@/lib/leads-csv";
import { listLeadsForExport } from "@/lib/lead-store";
import { checkRateLimit } from "@/lib/rate-limit";

// Tải lead đã trích xuất ra CSV (?quality=good|ok|spam để lọc; bỏ trống = tất cả).
// Route này xuất dữ liệu cá nhân của khách nên tự kiểm tra quyền (admin hoặc nhân viên; xuất là đọc nên nhân viên cũng được).
export async function GET(request: Request) {
  const allowed = await checkStaffRead();
  if (!allowed.ok) {
    return new Response("Cần đăng nhập quản trị.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = checkRateLimit(`lead-export:${ip}`, 6);
  if (!limited.ok) {
    return new Response("Bạn tải hơi nhanh, thử lại sau ít giây.", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const filter = parseQualityFilter(new URL(request.url).searchParams.get("quality"));
  // "none" (chưa trích xuất) không có lead nào để xuất nên coi như không lọc.
  const quality = filter && filter !== "none" ? filter : null;

  try {
    const leads = await listLeadsForExport(quality);
    const csv = leadsToCsv(
      leads.map((l) => ({
        conversationId: l.conversationId,
        conversationStartedAt: l.conversationStartedAt ? formatDateTime(l.conversationStartedAt) : "",
        lastMessageAt: l.conversationLastMessageAt ? formatDateTime(l.conversationLastMessageAt) : "",
        name: l.name,
        email: l.email,
        phone: l.phone,
        studyCountry: l.studyCountry,
        educationLevel: l.educationLevel,
        major: l.major,
        availability: l.availability,
        wantsConsultation: l.wantsConsultation,
        note: l.note,
        quality: l.quality,
        qualityReason: l.qualityReason,
        extractedAt: formatDateTime(l.extractedAt),
      })),
    );

    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${day}${quality ? `-${quality}` : ""}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[admin/conversations/export] Xuất CSV thất bại:", err);
    return new Response("Không xuất được CSV do lỗi database.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
