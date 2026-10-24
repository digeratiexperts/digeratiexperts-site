import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Check, KeyRound, Loader2, Plus, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { licenseBoardApi, type Board, type NewPoolItem } from "@/lib/licenseBoardApi";
import type { ShelfEntry } from "@shared/licenseShelf";

/**
 * The catalog (opened from "Add from catalog" in a side panel): every licence
 * and app DE can put in its pool, as rows on shelves (Productivity, Security,
 * Baseline apps, Agents, Line-of-business, Hub SKUs). Search or pick a shelf,
 * press Add: it lands in DE's pool ready to be patched. Anything not listed
 * goes in through the form at the bottom.
 */

const PAX8_NOTE: Record<string, string> = {
  AUTH_REQUIRED: "not connected (Pax8 credentials not set on the Hub)",
  FAILED: "the last read failed",
  STALE: "showing an older read",
};

const sameProduct =(a: { vendor: string; product: string }, b: { vendor: string; product: string }) =>
  a.vendor.toLowerCase() === b.vendor.toLowerCase() && a.product.toLowerCase() === b.product.toLowerCase();

function PartRow({ entry, inPool, onAdd }: { entry: ShelfEntry; inPool: boolean; onAdd: (seats: number) => Promise<void> }) {
  const [seats, setSeats] = useState("10");
  const [busy, setBusy] = useState(false);
  const KindIcon = entry.kind === "app" ? AppWindow : KeyRound;
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <KindIcon className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{entry.product}</p>
          <p className="text-xs text-white/50">
            {entry.vendor} · {entry.kind === "app" ? "App" : "Licence"}
            {entry.sku ? <span className="font-mono"> · {entry.sku}</span> : null}
            {entry.chocoPackage ? <span className="font-mono text-emerald-300"> · choco {entry.chocoPackage}</span> : null}
          </p>
        </div>
      </div>
      {inPool ? (
        <p className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400">
          <Check className="h-3.5 w-3.5" aria-hidden /> In the pool
        </p>
      ) : (
        <form
          className="flex shrink-0 items-center gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onAdd(Number(seats) || 0);
            } finally {
              setBusy(false);
            }
          }}
        >
          {entry.kind === "license" ? (
            <label className="flex items-center gap-1.5 text-xs text-white/55">
              Seats
              <input
                type="number"
                min={0}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                aria-label={`Seats of ${entry.product} DE holds`}
                className="h-9 w-16 rounded-md border border-white/15 bg-black/40 px-2 text-sm text-white"
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            aria-label={`Add ${entry.product} to the pool`}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            Add
          </button>
        </form>
      )}
    </li>
  );
}

function MakePartForm({ categories, onAdd, onClose }: { categories: string[]; onAdd: (input: NewPoolItem) => Promise<void>; onClose: () => void }) {
  const [kind, setKind] = useState<"license" | "app">("app");
  const [vendor, setVendor] = useState("");
  const [product, setProduct] = useState("");
  const [category, setCategory] = useState("Line-of-business");
  const [seats, setSeats] = useState("10");
  const [sku, setSku] = useState("");
  const [choco, setChoco] = useState("");
  const [busy, setBusy] = useState(false);
  const field = "h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/35";
  return (
    <form
      className="space-y-2 rounded-md border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onAdd({
            kind,
            vendor: vendor.trim(),
            product: product.trim(),
            category,
            sku: sku.trim() || null,
            chocoPackage: kind === "app" ? choco.trim() || null : null,
            quantity: kind === "license" ? Number(seats) || 0 : 0,
          });
          onClose();
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Make a part</p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded text-white/50 hover:bg-white/10">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 p-1" role="radiogroup" aria-label="What is it">
        {(["app", "license"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k);
              setCategory(k === "app" ? "Line-of-business" : "Productivity");
            }}
            className={`min-h-9 rounded-md text-xs font-semibold ${kind === k ? "bg-[#D3126A]/25 text-white" : "text-white/55 hover:bg-white/5"}`}
          >
            {k === "app" ? "App (LOB, tool, agent)" : "Licence (counted seats)"}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} required placeholder="Vendor" aria-label="Vendor" className={field} />
        <input value={product} onChange={(e) => setProduct(e.target.value)} required placeholder="Product" aria-label="Product" className={field} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Shelf" className={field}>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-[#100c1a]">
              {c}
            </option>
          ))}
        </select>
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Vendor SKU (optional)" aria-label="Vendor SKU" className={field} />
        {kind === "license" ? (
          <label className="flex items-center gap-2 text-xs text-white/60">
            Seats DE holds
            <input type="number" min={0} value={seats} onChange={(e) => setSeats(e.target.value)} className="h-10 w-24 rounded-md border border-white/15 bg-black/30 px-2 text-sm text-white" />
          </label>
        ) : (
          <input
            value={choco}
            onChange={(e) => setChoco(e.target.value)}
            placeholder="Chocolatey package id (optional)"
            aria-label="Chocolatey package id"
            className={`${field} font-mono`}
          />
        )}
      </div>
      <button
        type="submit"
        disabled={busy || !vendor.trim() || !product.trim()}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-[#D3126A] px-4 text-sm font-semibold text-white hover:bg-[#A30E52] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        Add to pool
      </button>
    </form>
  );
}

export function PartsBin({ board, onAdded }: { board: Board; onAdded: () => void }) {
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["/api/portal/admin/license-board/shelf"], queryFn: licenseBoardApi.shelf, staleTime: 5 * 60_000 });
  const [shelf, setShelf] = useState<string>("Productivity");
  const [search, setSearch] = useState("");
  const [making, setMaking] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of q.data?.entries ?? []) m.set(e.category, (m.get(e.category) || 0) + 1);
    return m;
  }, [q.data]);

  const needle = search.trim().toLowerCase();
  const entries = (q.data?.entries ?? []).filter((e) =>
    needle ? `${e.vendor} ${e.product} ${e.sku ?? ""} ${e.chocoPackage ?? ""}`.toLowerCase().includes(needle) : e.category === shelf,
  );

  const add = async (input: NewPoolItem) => {
    try {
      const { item } = await licenseBoardApi.addItem(input);
      toast({ title: `${item.product} added to DE's pool`, description: "Pull a cable from its jack to patch it onto a company." });
      onAdded();
    } catch (err) {
      toast({ title: "Could not add it", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  return (
    <section aria-label="Catalog" className="space-y-3">
      <p className="text-xs text-white/50">
        {q.data ? (q.data.hubConnected ? "Hub SKUs connected." : "Hub SKUs not connected yet: showing the starter shelf and the catalog.") : ""}
        {q.data?.pax8 && q.data.pax8.status !== "CONNECTED" ? ` Pax8: ${PAX8_NOTE[q.data.pax8.status] ?? q.data.pax8.status}.` : ""}
      </p>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, vendor, SKU"
          aria-label="Search the catalog"
          className="h-10 w-full rounded-md border border-white/15 bg-black/30 pl-8 pr-3 text-sm text-white placeholder:text-white/35"
        />
      </label>

      {!needle ? (
        <div className="flex gap-1 overflow-x-auto border-b border-white/10" role="tablist" aria-label="Shelves">
          {(q.data?.categories ?? []).map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={shelf === c.key}
              title={c.blurb}
              onClick={() => setShelf(c.key)}
              className={`shrink-0 border-b-2 px-3 pb-2 pt-1 text-sm ${
                shelf === c.key ? "border-[#F04C97] text-white" : "border-transparent text-white/55 hover:text-white"
              }`}
            >
              {c.key} <span className="text-white/40">{counts.get(c.key) || 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading the catalog…
        </p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-white/55">
          {needle
            ? "Nothing matches."
            : shelf === "Hub SKUs"
              ? "No Hub SKUs yet: the Hub feed is not connected."
              : shelf === "Pax8"
                ? `No Pax8 products yet: ${q.data?.pax8?.message || "the Hub feed is not connected."}`
                : "This shelf is empty."}{" "}
          Add your own
          below.
        </p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {entries.map((e) => (
            <PartRow
              key={e.key}
              entry={e}
              inPool={board.items.some((i) => sameProduct(i, e))}
              onAdd={(seats) =>
                add({
                  kind: e.kind,
                  vendor: e.vendor,
                  product: e.product,
                  category: e.category,
                  catalogKey: e.catalogKey ?? null,
                  sku: e.sku ?? null,
                  chocoPackage: e.chocoPackage ?? null,
                  quantity: e.kind === "license" ? seats : 0,
                })
              }
            />
          ))}
        </ul>
      )}

      {making ? (
        <MakePartForm categories={(q.data?.categories ?? []).filter((c) => c.key !== "Hub SKUs" && c.key !== "Pax8").map((c) => c.key)} onAdd={add} onClose={() => setMaking(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setMaking(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add something not listed (LOB app, other SKU)
        </button>
      )}
    </section>
  );
}
