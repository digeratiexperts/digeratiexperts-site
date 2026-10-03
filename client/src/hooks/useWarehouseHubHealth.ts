import { useEffect, useState } from "react";

export type WarehouseFeedStatus =
  | "CONNECTED"
  | "STALE"
  | "FAILED"
  | "UNKNOWN"
  | "LOCAL_WORKSHOP"
  | "AUTH_REQUIRED";

type CatalogPayload = {
  status?: WarehouseFeedStatus;
  source?: string;
};

type ConnectorRow = {
  connector: string;
  status: WarehouseFeedStatus;
};

/**
 * Staff chrome health. Honest statuses only — never invent CONNECTED.
 */
export function useWarehouseHubHealth() {
  const [catalogStatus, setCatalogStatus] = useState<WarehouseFeedStatus>("UNKNOWN");
  const [pax8Status, setPax8Status] = useState<WarehouseFeedStatus>("UNKNOWN");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/internal/warehouse/catalog", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as CatalogPayload;
      })
      .then((json) => {
        if (!cancelled) setCatalogStatus(json.status ?? "UNKNOWN");
      })
      .catch(() => {
        if (!cancelled) setCatalogStatus("LOCAL_WORKSHOP");
      });

    fetch("/api/internal/warehouse/connectors", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        return (await res.json()) as { connectors?: ConnectorRow[] };
      })
      .then((json) => {
        if (cancelled) return;
        const pax8 = json.connectors?.find((row) => row.connector === "pax8");
        setPax8Status(pax8?.status ?? "UNKNOWN");
      })
      .catch(() => {
        if (!cancelled) setPax8Status("UNKNOWN");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogStatus, pax8Status };
}
