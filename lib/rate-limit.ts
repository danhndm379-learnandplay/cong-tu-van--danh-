// Rate limiter cửa sổ trượt, lưu trong bộ nhớ tiến trình.
// Lưu ý: trên serverless (Vercel) mỗi instance có bộ nhớ riêng nên giới hạn chỉ mang tính gần đúng;
// khi cần chặt chẽ hơn hãy chuyển sang kho dùng chung (Redis/Upstash, Supabase).

const hits = new Map<string, number[]>();
const PRUNE_THRESHOLD = 1000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkRateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > PRUNE_THRESHOLD) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return { ok: true };
}
