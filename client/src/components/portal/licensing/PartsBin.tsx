import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppWindow, Check, KeyRound, Loader2, Package, Plus, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { licenseBoardApi, type Board, type NewPoolItem } from "@/lib/licenseBoardApi";
import { PATCH_TONES, toneFor } from "./PatchBay";
import type { ShelfEntry } from "@shared/licenseShelf";

/**
 * The parts bin: every licence and app DE can put in its pool, on labelled
 * shelves (Productivity, Security, Baseline apps, Agents, Line-of-business,
 * Hub SKUs). Pick a shelf, find the part, press Add: it lands in the pool
 * ready to be patched. Anything not on a shelf goes in with "Make a part".
 */

const sameProduct = (a: { vendor: string; product: string }, b: { vendor: string; product: string }) =>
  a.vendor.toLowerCase() === b.vendor.toLowerCase() && a.product.toLowerCase() === b.product.toLowerCase();

function PartTile({ entry, inPool, onAdd }: { entry: ShelfEntry; inPool: boolean; onAdd: (seats: number) => Promise<void> }) {
  const [seats, setSeats] = useState("10");
  const [busy, setBusy] = useState(false);
  const color = PATCH_TONES[toneFor(entry.vendor.toLowerCase())];
  const KindIcon = entry.kind === "app" ? AppWindow : KeyRound;
  return (
    <li
      className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border bg-[#0d0a17] p-3 transition-shadow motion-reduce:transition-none"
      style={{ borderColor: inPool ? `${color}88` : "rgba(255,255,255,0.1)", boxShadow: inPool ? `0 0 16px ${color}33` : undefined }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <KindIcon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
          <p className="min-w-0 truncate font-[Oxanium] text-[11px] uppercase tracking-[0.14em] text-white/55">{entry.vendor}</p>
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{entry.product}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/55">
            {entry.kind === "app" ? "App · no seat count" : "Seats"}
          </span>
          {entry.sku ? <span className="rounded-full bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/60">{entry.sku}</span> : null}
          {entry.chocoPackage ? (
            <span className="rounded-full bg-[#34D399]/10 px-1.5 py-0.5 font-mono text-[10px] text-[#6EE7B7]" title="Chocolatey package id">
              choco {entry.chocoPackage}
            </span>
          ) : null}
        </div>
      </div>
      {inPool ? (
        <p className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
          <Check className="h-3.5 w-3.5" aria-hidden /> In the pool
        </p>
      ) : (
        <form
          className="flex items-center gap-1.5"
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
            <input
              type="number"
              min={0}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              aria-label={`Seats of ${entry.product} DE holds`}
              title="Seats DE holds with the vendor"
              className="h-9 w-16 rounded-md border border-white/15 bg-black/40 px-2 text-sm text-white"
            />
          ) : null}
          <button
            type="submit"
            disabled={busy}
            aria-label={`Add ${entry.product} to the pool`}
            className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-md border px-2 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            style={{ borderColor: `${color}88` }}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            <span>
              Add<span className="hidden xl:inline"> to pool</span>
            </span>
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
      className="space-y-2 rounded-xl border border-dashed border-[#F04C97]/40 bg-[#F04C97]/[0.04] p-3"
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

export function PartsBin({ board, onAdded, onClose }: { board: Board; onAdded: () => void; onClose: () => void }) {
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
      toast({ title: `${item.product} is in the pool`, description: "Pull a cable from its jack to patch it." });
      onAdded();
    } catch (err) {
      toast({ title: "Could not add it", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  return (
    <section aria-label="Parts bin" className="mb-6 rounded-2xl border border-white/10 bg-[#07050f] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Package className="h-4 w-4 text-[#C4B5FD]" aria-hidden />
        <h2 className="font-[Oxanium] text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Parts bin</h2>
        <span className="text-xs text-white/45">
          {q.data ? (q.data.hubConnected ? "Hub SKUs connected" : "Hub SKUs not connected: starter shelf and catalog") : ""}
        </span>
        <button type="button" onClick={onClose} className="ml-auto min-h-9 rounded-md px-2 text-xs text-white/55 hover:bg-white/10 hover:text-white">
          Close bin
        </button>
      </div>

      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search every shelf: vendor, product, SKU, choco id"
          aria-label="Search the parts bin"
          className="h-10 w-full rounded-md border border-white/15 bg-black/30 pl-8 pr-3 text-sm text-white placeholder:text-white/35"
        />
      </label>

      {!needle ? (
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Shelves">
          {(q.data?.categories ?? []).map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={shelf === c.key}
              title={c.blurb}
              onClick={() => setShelf(c.key)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition motion-reduce:transition-none ${
                shelf === c.key
                  ? "border-[#F04C97] bg-[#D3126A]/20 text-white shadow-[0_0_14px_rgba(240,76,151,0.35)]"
                  : "border-white/10 text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              {c.kind === "app" ? <AppWindow className="h-3.5 w-3.5" aria-hidden /> : <KeyRound className="h-3.5 w-3.5" aria-hidden />}
              {c.key}
              <span className="font-[Oxanium] text-white/45">{counts.get(c.key) || 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-white/55">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Stocking the shelves…
        </p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-white/55">
          {needle ? "Nothing on any shelf matches." : shelf === "Hub SKUs" ? "No Hub SKUs yet: the Hub feed is not connected." : "This shelf is empty."} Make
          your own part below.
        </p>
      ) : (
        <ul className="grid max-h-[26rem] grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 min-[480px]:grid-cols-2 sm:max-h-none sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((e) => (
            <PartTile
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

      <div className="mt-3">
        {making ? (
          <MakePartForm categories={(q.data?.categories ?? []).filter((c) => c.key !== "Hub SKUs").map((c) => c.key)} onAdd={add} onClose={() => setMaking(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setMaking(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-[#F04C97] hover:bg-white/5"
          >
            <Plus className="h-4 w-4" aria-hidden /> Make a part (LOB app, a SKU not on a shelf)
          </button>
        )}
      </div>
    </section>
  );
}
