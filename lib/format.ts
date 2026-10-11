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
