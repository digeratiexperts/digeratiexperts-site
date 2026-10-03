import { useEffect, useState } from "react";
import type { ThreatFeedPayload } from "@shared/threatFeed";
import { normalizeThreatAttribution, THREAT_ATTRIBUTION } from "@shared/threatFeed";

const emptyPayload = (status: ThreatFeedPayload["status"] = "empty"): ThreatFeedPayload => ({
  status,
  generatedAt: null,
  items: [],
  sources: {},
  attribution: THREAT_ATTRIBUTION,
});

function withCanonicalAttribution(payload: ThreatFeedPayload): ThreatFeedPayload {
  return {
    ...payload,
    items: Array.isArray(payload.items) ? payload.items : [],
    attribution: normalizeThreatAttribution(payload.attribution),
  };
}

export function useThreatFeed(scope: "homepage" | "all") {
  const [payload, setPayload] = useState<ThreatFeedPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    (async () => {
      try {
        const res = await fetch(`/api/public/threats?scope=${scope}`, { signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const data = (await res.json()) as ThreatFeedPayload;
        if (!cancelled) setPayload(withCanonicalAttribution(data));
      } catch {
        if (!cancelled) setPayload(emptyPayload("empty"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [scope]);

  return { payload: payload || emptyPayload(), loading };
}
