import { StatusBadge } from "@/components/status-badge";
import type { LeadQuality } from "@/lib/lead-sanitize";

const BADGE: Record<LeadQuality, { tone: "green" | "yellow" | "red"; label: string }> = {
  good: { tone: "green", label: "Good" },
  ok: { tone: "yellow", label: "OK" },
  spam: { tone: "red", label: "Spam" },
};

/** Nhãn chất lượng lead (Good/OK/Spam). Chưa trích xuất lead (null) thì hiện dấu "chưa trích xuất". */
export function LeadQualityBadge({ quality }: { quality: LeadQuality | null }) {
  if (!quality) return <span className="text-xs text-muted-foreground">Chưa trích xuất</span>;
  return <StatusBadge tone={BADGE[quality].tone} label={BADGE[quality].label} />;
}
