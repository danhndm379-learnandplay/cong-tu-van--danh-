const dateTimeFormat = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Định dạng thời điểm ISO theo giờ Việt Nam, ví dụ "09:06:43 11/10/2026". */
export function formatDateTime(iso: string) {
  return dateTimeFormat.format(new Date(iso));
}

/** Hiển thị điểm số: luôn có ít nhất 1 chữ số thập phân, tối đa 2 (7 → "7.0", 7.5 → "7.5", 7.25 → "7.25"). */
export function formatScore(value: number) {
  return value.toFixed(2).replace(/0$/, "");
}

/** "2005-05-12" → "12/05/2005" (không đổi múi giờ, vì đây là ngày chứ không phải thời điểm). */
export function formatIsoDate(iso: string | null) {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : null;
}

/** 45789 → "44.7 KB", 5242888 → "5.0 MB". */
export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
