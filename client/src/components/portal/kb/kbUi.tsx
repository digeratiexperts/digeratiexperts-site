import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KbRating } from "@shared/kb";

export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 60) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Stars({ rating, size = "sm" }: { rating: KbRating; size?: "sm" | "md" }) {
  const full = Math.round(rating.average);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={rating.count ? `Rated ${rating.average} out of 5 by ${rating.count}` : "Not rated yet"}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", n <= full ? "fill-current text-foreground" : "text-muted-foreground")} aria-hidden="true" />
      ))}
    </span>
  );
}
