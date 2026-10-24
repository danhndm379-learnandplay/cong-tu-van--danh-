import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocStatusBadge } from "@/components/status-badge";
import { formatDateTime, formatFileSize, formatIsoDate, formatScore } from "@/lib/format";
import {
  DOC_LABELS,
  DOC_TYPES,
  REQUIRED_FIELDS,
  type DocFields,
  type DocType,
  type FieldKey,
  type ProfileEvaluation,
} from "@/lib/portal-docs";
import type { StoredStudentDoc } from "@/lib/student-store";

interface Row {
  label: string;
  /** Trường dữ liệu để biết có bắt buộc/đọc được không (rỗng cho dòng ghép). */
  key: FieldKey;
  value: string | null;
}

function rowsFor(type: DocType, f: DocFields): Row[] {
  const score = (v: number | null) => (v === null ? null : formatScore(v));
  switch (type) {
    case "transcript":
      return [
        { label: "Họ tên", key: "fullName", value: f.fullName },
        { label: "Ngày sinh", key: "dateOfBirth", value: formatIsoDate(f.dateOfBirth) },
        { label: "Điểm học tập tổng kết", key: "gpa", value: score(f.gpa) },
        { label: "Thang điểm", key: "gpaScale", value: f.gpaScale === null ? null : `Thang ${f.gpaScale}` },
      ];
    case "ielts":
      return [
        { label: "Họ tên trên chứng chỉ", key: "fullName", value: f.fullName },
        { label: "Nghe (Listening)", key: "listening", value: score(f.listening) },
        { label: "Đọc (Reading)", key: "reading", value: score(f.reading) },
        { label: "Viết (Writing)", key: "writing", value: score(f.writing) },
        { label: "Nói (Speaking)", key: "speaking", value: score(f.speaking) },
        { label: "Điểm tổng (Overall)", key: "overall", value: score(f.overall) },
        { label: "Ngày thi", key: "testDate", value: formatIsoDate(f.testDate) },
      ];
    case "identity":
      return [
        { label: "Họ tên", key: "fullName", value: f.fullName },
        { label: "Ngày sinh", key: "dateOfBirth", value: formatIsoDate(f.dateOfBirth) },
        { label: "Số giấy tờ", key: "documentNumber", value: f.documentNumber },
      ];
  }
}

/** Toàn bộ thông tin Gemini đã đọc được từ từng giấy tờ; trường bắt buộc mà không đọc được hiện rõ để học viên biết. */
export function ExtractedInfo({
  documents,
  evaluation,
}: {
  documents: Partial<Record<DocType, StoredStudentDoc>>;
  evaluation: ProfileEvaluation;
}) {
  const present = DOC_TYPES.filter((type) => documents[type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin đã trích xuất</CardTitle>
        <p className="text-sm text-muted-foreground">
          Đây là thông tin hệ thống đọc được từ giấy tờ bạn đã nộp. Hãy kiểm tra xem có đúng không; nếu sai, bạn nộp lại file rõ hơn.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {present.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có giấy tờ nào được đọc. Hãy nộp giấy tờ ở phần trên.</p>
        ) : (
          present.map((type) => {
            const doc = documents[type]!;
            const required = REQUIRED_FIELDS[type];
            return (
              <section key={type}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold">{DOC_LABELS[type]}</h3>
                  <DocStatusBadge status={evaluation.docs[type].status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.fileName ? <span className="break-all">{doc.fileName}</span> : "File"}
                  {doc.sizeBytes !== null ? ` · ${formatFileSize(doc.sizeBytes)}` : ""} · đọc lúc {formatDateTime(doc.extractedAt)}
                </p>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  {rowsFor(type, doc.fields).map((row) => (
                    <div key={row.label} className="rounded-lg bg-muted/40 p-3">
                      <dt className="text-xs text-muted-foreground">{row.label}</dt>
                      <dd className="mt-1 text-base font-medium">
                        {row.value ??
                          (required.includes(row.key) ? (
                            <span className="text-sm font-normal text-red-600">Không đọc được</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
