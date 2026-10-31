"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateStudentDocumentAction } from "@/app/admin/profiles/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EDITABLE_FIELDS, GPA_SCALE_OPTIONS } from "@/lib/admin-profile-form";
import type { DocFields, DocType } from "@/lib/portal-docs";

/** Form admin sửa thông tin một giấy tờ (chỉ hiển thị cho admin; nhân viên không thấy, và server/database cũng từ chối họ). */
export function StudentDocEditor({ profileId, type, fields }: { profileId: string; type: DocType; fields: DocFields }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      const result = await updateStudentDocumentAction(profileId, type, form);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setMessage({ ok: true, text: result.problems.length ? `Đã lưu. Lưu ý: ${result.problems.join(" ")}` : "Đã lưu. Giấy tờ hợp lệ." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {EDITABLE_FIELDS[type].map((field) => {
          const id = `${type}-${field.key}`;
          const value = fields[field.key];
          return (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={id}>{field.label}</Label>
              {field.kind === "scale" ? (
                <select
                  id={id}
                  name={field.key}
                  defaultValue={value === null ? "" : String(value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">— chưa có —</option>
                  {GPA_SCALE_OPTIONS.map((scale) => (
                    <option key={scale} value={scale}>
                      Thang {scale}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id}
                  name={field.key}
                  type={field.kind === "date" ? "date" : field.kind === "text" ? "text" : "number"}
                  step={field.kind === "band" ? 0.5 : field.kind === "number" ? 0.01 : undefined}
                  min={field.kind === "band" || field.kind === "number" ? 0 : undefined}
                  max={field.kind === "band" ? 9 : undefined}
                  maxLength={field.kind === "text" ? 200 : undefined}
                  defaultValue={value === null ? "" : String(value)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          <Save />
          {pending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
