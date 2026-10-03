import { useEffect, useState } from "react";

type StockLine = { sku: string; onHand: number; reserved: number };

export function WarehouseStockPanel() {
  const [lines, setLines] = useState<StockLine[]>([]);
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [carrier, setCarrier] = useState("ups");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/internal/warehouse/stock", { credentials: "include" });
    if (!response.ok) {
      setMessage("Stock is unavailable.");
      return;
    }
    const body = (await response.json()) as { lines: StockLine[] };
    setLines(body.lines);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function move(kind: "receive" | "pick" | "ship") {
    setMessage("");
    const response = await fetch(`/api/internal/warehouse/stock/${kind}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        quantity: Number(quantity),
        carrier,
        trackingNumber,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; lines?: StockLine[] };
    if (!response.ok) {
      setMessage(body.error || "That stock movement was refused.");
      return;
    }
    setLines(body.lines ?? []);
    setMessage(kind === "ship" ? "Shipment recorded." : "Stock updated.");
  }

  return (
    <section className="mx-auto mb-8 max-w-5xl rounded-2xl border border-white/10 bg-black px-4 py-5 text-white" aria-label="Warehouse stock">
      <h2 className="font-semibold">On-hand stock</h2>
      <p className="mt-1 text-sm text-white/70">Staff only. Receive, pick, then ship with a carrier and tracking number.</p>
      <ul className="mt-4 space-y-1 text-sm">
        {lines.length === 0 ? <li className="text-white/60">No stock recorded yet.</li> : null}
        {lines.map((line) => (
          <li key={line.sku}>
            {line.sku}: {line.onHand} on hand, {line.reserved} picked
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="rounded border border-white/20 bg-black px-3 py-2" value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU" aria-label="SKU" />
        <input className="w-24 rounded border border-white/20 bg-black px-3 py-2" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-label="Quantity" />
        <input className="rounded border border-white/20 bg-black px-3 py-2" value={carrier} onChange={(event) => setCarrier(event.target.value)} aria-label="Carrier" />
        <input className="rounded border border-white/20 bg-black px-3 py-2" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="Tracking number" aria-label="Tracking number" />
        <button type="button" className="rounded bg-[#D3126A] px-3 py-2" onClick={() => void move("receive")}>Receive</button>
        <button type="button" className="rounded border border-white/20 px-3 py-2" onClick={() => void move("pick")}>Pick</button>
        <button type="button" className="rounded border border-white/20 px-3 py-2" onClick={() => void move("ship")}>Ship</button>
      </div>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </section>
  );
}
