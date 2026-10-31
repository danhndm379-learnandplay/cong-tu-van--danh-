import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { UserBar } from "@/components/auth/user-bar";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentUploadCard } from "@/components/portal/document-upload-card";
import { ExtractedInfo } from "@/components/portal/extracted-info";
import { ProfileStatus } from "@/components/portal/profile-status";
import { SchoolMatch } from "@/components/portal/school-match";
import { ScholarshipPanel } from "@/components/portal/scholarship-panel";
import { formatFileSize } from "@/lib/format";
import { DOC_TYPES, type DocType } from "@/lib/portal-docs";
import { buildAdviceContext, computePortalResults } from "@/lib/portal-results";
import { loadStudentSnapshot } from "@/lib/student-store";
import { getCurrentUser } from "@/lib/supabase-auth";

// Trang riêng tư của học viên: không để công cụ tìm kiếm lập chỉ mục.
export const metadata: Metadata = {
  title: "Cổng hồ sơ — DuHoc24",
  robots: { index: false, follow: false },
};

export default async function PortalPage() {
  // Chưa đăng nhập thì không vào được cổng hồ sơ: chuyển sang trang đăng nhập (proxy.ts cũng chặn sớm; đây là lớp kiểm tra chính).
  // Trang đọc phiên đăng nhập nên luôn render theo từng người dùng (không prerender, không dùng chung bộ nhớ đệm).
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let loaded: {
    snapshot: Awaited<ReturnType<typeof loadStudentSnapshot>>;
    results: Awaited<ReturnType<typeof computePortalResults>>;
    advice: Awaited<ReturnType<typeof buildAdviceContext>>;
  } | null = null;
  try {
    const snapshot = await loadStudentSnapshot(user.id);
    const results = await computePortalResults(snapshot);
    const advice = await buildAdviceContext(snapshot, results);
    loaded = { snapshot, results, advice };
  } catch (err) {
    console.error("[portal] Không tải được hồ sơ:", err);
  }

  if (!loaded) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
          <UserBar user={user} />
          <Card className="p-6 text-sm text-muted-foreground">
            Không tải được hồ sơ của bạn lúc này (lỗi kết nối cơ sở dữ liệu). Bạn tải lại trang sau ít phút nhé.
          </Card>
        </main>
      </>
    );
  }

  const { snapshot, results, advice } = loaded;
  const { evaluation, scores, matches } = results;
  const docs = snapshot.documents;
  const studentName = docs.identity?.fields.fullName ?? docs.transcript?.fields.fullName ?? docs.ielts?.fields.fullName ?? null;

  const fileLabel = (type: DocType) => {
    const doc = docs[type];
    if (!doc) return null;
    return `${doc.fileName ?? "File đã nộp"}${doc.sizeBytes !== null ? ` · ${formatFileSize(doc.sizeBytes)}` : ""}`;
  };
  const fileNames = Object.fromEntries(DOC_TYPES.map((t) => [t, docs[t]?.fileName ?? null])) as Partial<Record<DocType, string | null>>;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <UserBar user={user} />
        <div className="border-b pb-6">
          <p className="text-sm text-muted-foreground">{studentName ? "Xin chào," : "Cổng hồ sơ du học"}</p>
          <h1 className="text-2xl font-medium tracking-tight">{studentName ?? "Hồ sơ của bạn"}</h1>
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Giấy tờ được gửi tới dịch vụ AI Google Gemini để đọc thông tin. Hệ thống không lưu file gốc, chỉ lưu thông tin đã đọc
              được, và dữ liệu này chỉ máy chủ truy cập được. Hồ sơ gắn với tài khoản đăng nhập của bạn và chỉ bạn xem được.
            </span>
          </p>
        </div>

        <section className="mt-8">
          <ProfileStatus evaluation={evaluation} fileNames={fileNames} />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium">Giấy tờ cần nộp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nộp đủ 3 loại giấy tờ dưới đây. Sau khi nộp, hệ thống tự đọc thông tin, kiểm tra đủ/thiếu và đối chiếu điểm chuẩn giúp bạn.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            {DOC_TYPES.map((type) => (
              <DocumentUploadCard
                key={`${type}-${docs[type]?.extractedAt ?? "none"}`}
                type={type}
                status={evaluation.docs[type].status}
                problems={evaluation.docs[type].problems}
                fileLabel={fileLabel(type)}
              />
            ))}
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <ExtractedInfo documents={docs} evaluation={evaluation} />

          {scores && matches ? (
            <>
              <SchoolMatch matches={matches} scores={scores} />
              {advice ? (
                <ScholarshipPanel key={advice.inputHash} initialAdvice={advice.cached} autoGenerate={advice.cached === null} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Gợi ý học bổng</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Hiện chưa có trường nào đạt yêu cầu điểm chuẩn nên chưa có học bổng để gợi ý. Khi điểm của bạn đạt thêm trường nào, gợi ý sẽ xuất hiện ở đây.
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Đối chiếu điểm chuẩn và gợi ý học bổng</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Hệ thống chỉ đối chiếu điểm chuẩn và gợi ý học bổng khi hồ sơ đã đủ 3 giấy tờ và đều hợp lệ. {evaluation.headline}
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
