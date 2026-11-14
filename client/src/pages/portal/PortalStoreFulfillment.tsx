import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { PortalLayout } from "./PortalLayout";
import { deStoreFetch } from "@/lib/deStoreApi";
import { SHIPPING_PROMISE, DAY_5_DELAY_NOTICE_SUMMARY } from "@shared/deStoreLegalCopy";

type FulfillmentRecord = {
  siteOrderId: string;
  hubOrderId?: string;
  status?: string;
  promisedShipByDate?: string;
  events: Array<{
    eventId: string;
    eventType: string;
    occurredAt: string;
    payload: Record<string, unknown>;
  }>;
};

function statusLabel(status?: string): string {
  if (!status) return "Waiting for the Hub";
  return status.replace(/_/g, " ");
}

export default function PortalStoreFulfillment() {
  const params = useParams<{ id?: string }>();
  const [record, setRecord] = useState<FulfillmentRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    deStoreFetch(`/api/store/v1/orders/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          setError("No fulfillment record is available for this order yet.");
          return;
        }
        setRecord((await res.json()) as FulfillmentRecord);
      })
      .catch(() => setError("The fulfillment record could not be loaded."));
  }, [params.id]);

  const delayEvent = record?.events.find((event) => event.eventType === "fulfillment.delay_notice_sent");

  return (
    <PortalLayout
      title="Store order status"
      description="Fulfillment status comes from the Hub. The site does not mark an order shipped, delayed, cancelled, or refunded on its own."
      width="narrow"
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{SHIPPING_PROMISE}</p>
      {record ? (
        <dl className="mt-8 space-y-3 text-base">
          <div className="flex justify-between gap-4">
            <dt>Site order</dt>
            <dd>{record.siteOrderId}</dd>
          </div>
          {record.hubOrderId && (
            <div className="flex justify-between gap-4">
              <dt>Hub order</dt>
              <dd>{record.hubOrderId}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt>Status</dt>
            <dd className="capitalize">{statusLabel(record.status)}</dd>
          </div>
          {record.promisedShipByDate && (
            <div className="flex justify-between gap-4">
              <dt>Promised ship-by date</dt>
              <dd>{record.promisedShipByDate}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-8 text-base">{error || "Loading fulfillment status."}</p>
      )}

      {delayEvent && (
        <div className="mt-8 rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold">Shipping delay</h2>
          <p className="mt-3 leading-relaxed">{DAY_5_DELAY_NOTICE_SUMMARY}</p>
          {typeof delayEvent.payload.proposedShipByDate === "string" && (
            <p className="mt-3">Proposed ship-by date: {delayEvent.payload.proposedShipByDate}</p>
          )}
        </div>
      )}

      {record?.events.length ? (
        <ol className="mt-8 space-y-3">
          {record.events.map((event) => (
            <li key={event.eventId} className="rounded-xl border border-border p-4">
              <p className="font-medium capitalize">{event.eventType.replace(/\./g, " — ").replace(/_/g, " ")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{event.occurredAt}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </PortalLayout>
  );
}
