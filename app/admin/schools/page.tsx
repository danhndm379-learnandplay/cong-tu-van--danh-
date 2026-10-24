import { connection } from "next/server";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
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
import { listSchools } from "@/lib/school-store";

export default async function AdminSchoolsPage() {
  // Đọc dữ liệu thật từ Supabase mỗi lần xem (không prerender lúc build, để sửa dữ liệu trong DB là thấy ngay).
  await connection();

  let schools: Awaited<ReturnType<typeof listSchools>> | null = null;
  try {
    schools = await listSchools();
  } catch (err) {
    console.error("[admin/schools] Không tải được danh sách trường:", err);
  }

  return (
    <>
      <AdminPageHeader
        title="Trường tham chiếu"
        description="Điểm chuẩn dùng để đối chiếu hồ sơ học viên."
        action={
          <Button>
            <Plus className="size-4" />
            Thêm trường mới
          </Button>
        }
      />

      {!schools ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Không tải được danh sách trường từ database. Kiểm tra biến SUPABASE_URL và SUPABASE_PUBLISHABLE_KEY rồi thử lại.
        </Card>
      ) : schools.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">Chưa có trường tham chiếu nào.</Card>
      ) : (
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên trường</TableHead>
              <TableHead>Quốc gia</TableHead>
              <TableHead>Điểm học tập tối thiểu</TableHead>
              <TableHead>Điểm IELTS tối thiểu</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schools.map((school) => (
              <TableRow key={school.id}>
                <TableCell className="font-medium">{school.name}</TableCell>
                <TableCell>{school.country}</TableCell>
                <TableCell>{formatScore(school.minGpa)}</TableCell>
                <TableCell>{formatScore(school.minIelts)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="icon-sm" variant="outline" aria-label="Sửa">
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="outline" aria-label="Xoá">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}
    </>
  );
}
