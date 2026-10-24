import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatScore } from "@/lib/format";
import { conditionText, supportText } from "@/lib/scholarship-format";
import { listSchools, listScholarships } from "@/lib/school-store";

export const metadata: Metadata = {
  title: "Điểm chuẩn các trường — DuHoc24",
  description: "Điểm học tập và IELTS tối thiểu của từng trường tham chiếu, cùng các học bổng áp dụng.",
};

// Trang CÔNG KHAI: ai cũng xem được, không cần nộp hồ sơ. Đọc dữ liệu thật từ Supabase mỗi lần xem.
export default async function SchoolsPage() {
  await connection();

  let data: { schools: Awaited<ReturnType<typeof listSchools>>; scholarships: Awaited<ReturnType<typeof listScholarships>> } | null = null;
  try {
    const [schools, scholarships] = await Promise.all([listSchools(), listScholarships()]);
    data = { schools, scholarships };
  } catch (err) {
    console.error("[schools] Không tải được dữ liệu trường:", err);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-32">
        <h1 className="text-3xl font-medium tracking-tight">Điểm chuẩn các trường</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Điểm học tập (thang 10) và điểm IELTS tối thiểu để đạt yêu cầu của từng trường tham chiếu. Nộp hồ sơ ở cổng hồ sơ,
          hệ thống sẽ tự đối chiếu điểm của bạn với các điểm chuẩn này.
        </p>

        {!data ? (
          <Card className="mt-8 p-6 text-sm text-muted-foreground">
            Không tải được dữ liệu các trường lúc này. Bạn tải lại trang sau ít phút nhé.
          </Card>
        ) : (
          <>
            <section className="mt-8">
              <h2 className="text-lg font-medium">Trường tham chiếu</h2>
              {data.schools.length === 0 ? (
                <Card className="mt-4 p-6 text-sm text-muted-foreground">Chưa có trường nào.</Card>
              ) : (
                <Card className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tên trường</TableHead>
                        <TableHead>Quốc gia</TableHead>
                        <TableHead>Điểm học tập tối thiểu</TableHead>
                        <TableHead>Điểm IELTS tối thiểu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.schools.map((school) => (
                        <TableRow key={school.id}>
                          <TableCell className="font-medium">{school.name}</TableCell>
                          <TableCell>{school.country}</TableCell>
                          <TableCell>{formatScore(school.minGpa)}</TableCell>
                          <TableCell>{formatScore(school.minIelts)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </section>

            <section className="mt-10">
              <h2 className="text-lg font-medium">Học bổng</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Điều kiện tối thiểu và mức hỗ trợ của từng học bổng. Đáp ứng điều kiện tối thiểu chưa đảm bảo nhận được học bổng.
              </p>
              {data.scholarships.length === 0 ? (
                <Card className="mt-4 p-6 text-sm text-muted-foreground">Chưa có học bổng nào.</Card>
              ) : (
                <Card className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Học bổng</TableHead>
                        <TableHead>Trường</TableHead>
                        <TableHead>Điều kiện tối thiểu</TableHead>
                        <TableHead>Mức hỗ trợ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.scholarships.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.schoolName}</TableCell>
                          <TableCell>{conditionText(s.conditionMetric, s.conditionMin)}</TableCell>
                          <TableCell>{supportText(s.supportType, s.supportPercent)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </section>
          </>
        )}

        <div className="mt-10">
          <Button size="lg" nativeButton={false} render={<Link href="/portal">Nộp hồ sơ để đối chiếu điểm của bạn</Link>} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
