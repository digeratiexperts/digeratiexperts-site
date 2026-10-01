import { useEffect, useState } from "react";
import { Bell, Radio } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeActivity, markPortalActivitySeen, usePortalActivity } from "./portalActivity";

function relative(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** Live updates received over the portal event stream in this session. */
export function PortalActivityPopover() {
  const { connected, events, unseen } = usePortalActivity();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) markPortalActivitySeen();
  }, [open, events.length]);

  const label = unseen > 0 ? `Live updates, ${unseen} new` : "Live updates";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-9 w-9 border-border bg-card hover:bg-accent" aria-label={label} data-testid="button-live-updates">
          <Bell className="h-4 w-4" aria-hidden="true" />
          {unseen > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" aria-hidden="true" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <p className="font-heading text-sm font-semibold">Live updates</p>
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em]", connected ? "pt-ink pt-tone-ok" : "text-muted-foreground")}>
            <Radio className="h-3 w-3" aria-hidden="true" />
            {connected ? "connected" : "reconnecting"}
          </span>
        </div>
        {events.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No updates yet this session. Ticket replies, approvals and billing changes appear here as they happen.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-auto">
            {events.map((event) => (
              <li key={event.id} className="px-3 py-2.5 text-sm">
                <p className="font-medium">{describeActivity(event.eventType)}</p>
                <p className="text-xs text-muted-foreground">
                  {event.entityId ? `${event.entityId} · ` : ""}
                  {relative(event.receivedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
