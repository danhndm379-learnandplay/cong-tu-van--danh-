"use server";

import { revalidatePath } from "next/cache";
import { checkAdminWrite } from "@/lib/admin-guard";
import { parseDocForm } from "@/lib/admin-profile-form";
import { deleteProfileByAdmin, isProfileId, updateDocumentByAdmin } from "@/lib/admin-student-store";
import { DOC_TYPES, evaluateDocument, type DocType } from "@/lib/portal-docs";

export type UpdateDocResult = { ok: true; problems: string[] } | { ok: false; error: string };
export type DeleteProfileResult = { ok: true } | { ok: false; error: string };

const DENIED = "Bạn không có quyền sửa dữ liệu này, hoặc hồ sơ không còn tồn tại. Hãy tải lại trang.";

/**
 * Admin sửa thông tin một giấy tờ của học viên. Server Action là endpoint công khai nên tự kiểm tra quyền (chỉ admin; nhân viên bị từ chối),
 * và thao tác ghi chạy bằng phiên của người dùng nên RLS ở database cũng từ chối nếu không phải admin.
 */
export async function updateStudentDocumentAction(profileId: string, type: DocType, formData: FormData): Promise<UpdateDocResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (!isProfileId(profileId) || !DOC_TYPES.includes(type)) return { ok: false, error: "Dữ liệu gửi lên không hợp lệ." };

  const parsed = parseDocForm(type, (name) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : null;
  });
  if (!parsed.ok) return { ok: false, error: parsed.errors.join(" ") };

  try {
    if (!(await updateDocumentByAdmin(profileId, type, parsed.fields))) return { ok: false, error: DENIED };
  } catch (err) {
    console.error("[admin/profiles] Sửa giấy tờ thất bại:", err);
    return { ok: false, error: "Không lưu được do lỗi database, thử lại sau." };
  }

  console.info(`[admin/profiles] Admin đã sửa giấy tờ ${type} của hồ sơ ${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath(`/admin/profiles/${profileId}`);
  return { ok: true, problems: evaluateDocument(type, parsed.fields).problems };
}

/** Admin xoá vĩnh viễn một hồ sơ học viên và toàn bộ giấy tờ của hồ sơ đó. */
export async function deleteStudentProfileAction(profileId: string): Promise<DeleteProfileResult> {
  const allowed = await checkAdminWrite();
  if (!allowed.ok) return allowed;

  if (!isProfileId(profileId)) return { ok: false, error: "Id hồ sơ không hợp lệ." };

  try {
    if (!(await deleteProfileByAdmin(profileId))) return { ok: false, error: DENIED };
  } catch (err) {
    console.error("[admin/profiles] Xoá hồ sơ thất bại:", err);
    return { ok: false, error: "Không xoá được do lỗi database, thử lại sau." };
  }

  console.info(`[admin/profiles] Admin đã xoá hồ sơ ${profileId}`);
  revalidatePath("/admin/profiles");
  return { ok: true };
}
