import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/admin-guard";

export default async function AdminIndexPage() {
  await requireStaff();
  redirect("/admin/requests");
}
