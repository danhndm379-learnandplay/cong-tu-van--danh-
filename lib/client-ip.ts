/** IP của client (để giới hạn tần suất): lấy từ x-forwarded-for do Vercel/proxy đặt, không có thì "local". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}
