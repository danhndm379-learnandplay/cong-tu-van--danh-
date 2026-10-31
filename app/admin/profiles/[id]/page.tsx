import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DeleteProfileButton } from "@/components/admin/delete-profile-button";
import { StudentDocEditor } from "@/components/admin/student-doc-editor";
import { DocStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/admin-guard";
import { EDITABLE_FIELDS } from "@/lib/admin-profile-form";
import { getProfileForAdmin } from "@/lib/admin-student-store";
import { formatDateTime, formatIsoDate, formatScore } from "@/lib/format";
import { DOC_LABELS, DOC_TYPES, evaluateProfile, type DocFields, type DocType, type FieldKey } from "@/lib/portal-docs";

function displayValue(key: FieldKey, fields: DocFields): string | null {
  const value = fields[key];
  if (value === null) return null;
  if (key === "dateOfBirth" || key === "testDate") return formatIsoDate(value as string);
  if (key === "gpaScale") return `Thang ${value}`;
  if (typeof value === "number") return formatScore(value);
  return String(value);
}

export default async function AdminProfileDetailPage({ params }: PageProps<"/admin/profiles/[id]">) {
  // admin: xem + sửa + xoá; nhân viên: chỉ xem (không có form sửa và nút xoá; server và database cũng từ chối họ).
  const { canWrite } = await requireStaff();
  await connection();

  const { id } = await params;
  let profile: Awaited<ReturnType<typeof getProfileForAdmin>>;
  try {
    profile = await getProfileForAdmin(id);
  } catch (err) {
    console.error("[admin/profiles/id] Không tải được hồ sơ:", err);
    return <Card className="p-6 text-sm text-destructive">Không tải được hồ sơ. Kiểm tra kết nối Supabase rồi tải lại trang.</Card>;
  }
  if (!profile) notFound();

  const evaluation = evaluateProfile(
    Object.fromEntries(DOC_TYPES.filter((t) => profile.documents[t]).map((t) => [t, profile.documents[t]!.fields])) as Partial<Record<DocType, DocFields>>,
  );
  const name =
    profile.documents.identity?.fields.fullName ?? profile.documents.transcript?.fields.fullName ?? profile.documents.ielts?.fields.fullName ?? "Học viên";

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/admin/profiles" />}>
          <ArrowLeft />
          Danh sách hồ sơ
        </Button>
      </div>
      <AdminPageHeader
        title={name}
        description={`${profile.email ?? "Không rõ email"} · Tạo ${formatDateTime(profile.createdAt)} · Cập nhật ${formatDateTime(profile.updatedAt)}`}
        action={canWrite ? <DeleteProfileButton profileId={profile.id} name={name} /> : undefined}
      />

      <p className="mb-6 text-sm text-muted-foreground">
        {evaluation.headline}
        {!canWrite && " Bạn đang đăng nhập bằng tài khoản nhân viên nên chỉ được xem."}
      </p>

      <div className="space-y-6">
        {DOC_TYPES.map((type) => {
          const doc = profile.documents[type];
          const status = evaluation.docs[type];
          return (
            <Card key={type} className="p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-medium">{DOC_LABELS[type]}</h2>
                  {doc && (
                    <p className="text-xs text-muted-foreground">
                      {doc.fileName ?? "File"} · {doc.model === "admin_edit" ? "đã được admin sửa tay" : "AI đọc"} · {formatDateTime(doc.extractedAt)}
                    </p>
                  )}
                </div>
                <DocStatusBadge status={status.status} />
              </div>

              {!doc ? (
                <p className="mt-4 text-sm text-muted-foreground">Học viên chưa nộp giấy tờ này.</p>
              ) : (
                <>
                  {status.problems.length > 0 && (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-destructive">
                      {status.problems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                  {canWrite ? (
                    <div className="mt-4">
                      <StudentDocEditor key={`${type}-${doc.extractedAt}`} profileId={profile.id} type={type} fields={doc.fields} />
                    </div>
                  ) : (
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      {EDITABLE_FIELDS[type].map((field) => (
                        <div key={field.key}>
                          <dt className="text-xs text-muted-foreground">{field.label}</dt>
                          <dd className="mt-0.5 break-words text-sm">{displayValue(field.key, doc.fields) ?? <span className="text-muted-foreground">—</span>}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
