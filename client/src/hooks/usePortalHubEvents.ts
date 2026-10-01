import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  portalActivityConnected,
  recordPortalActivity,
} from "@/components/portal/shell/portalActivity";

function shouldInvalidate(queryKey: readonly unknown[]): boolean {
  const first = String(queryKey[0] ?? "");
  return first.includes("/api/portal") || first.includes("/api/store");
}

export function usePortalHubEvents(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.startsWith("/portal")) return;

    const source = new EventSource("/api/portal/events/stream");
    source.onopen = () => portalActivityConnected(true);
    source.onerror = () => portalActivityConnected(false);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { eventType?: string; entityId?: string };
        if (!payload.eventType) return;
        if (payload.eventType === "stream.ready") {
          portalActivityConnected(true);
          return;
        }
        recordPortalActivity({ eventType: payload.eventType, entityId: payload.entityId });
        void queryClient.invalidateQueries({
          predicate: (query) => shouldInvalidate(query.queryKey),
        });
      } catch {
        /* ignore malformed SSE */
      }
    };
    return () => {
      source.close();
      portalActivityConnected(false);
    };
  }, [queryClient]);
}
