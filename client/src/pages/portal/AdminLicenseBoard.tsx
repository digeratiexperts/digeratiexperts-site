import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Building2, ChevronRight, Cpu, KeyRound, Minus, Monitor, Plus, Search, Trash2, Users, X } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Callout } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  PatchBay,
  PatchCard,
  PatchJack,
  PatchTarget,
  PATCH_TONES,
  toneFor,
  type PatchCable,
} from "@/components/portal/licensing/PatchBay";
import { licenseBoardApi, type Board, type CompanyBoard } from "@/lib/licenseBoardApi";
import { PartsBin } from "@/components/portal/licensing/PartsBin";
import { JumpCloudTab, StarterKitTab, jumpcloudKey, jumpcloudState, useJumpCloud } from "@/components/portal/licensing/CompanyTools";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EVERY_MACHINE_ID, deviceTargetId } from "@shared/licenseBoard";

/**
 * License patch bay (DE admin). Level 1: DE's pool of vendor licences on the
 * left, client companies on the right; pull a cable from a licence onto a
 * company to give it a seat (DE's pool first, the rest recorded to order).
 * Level 2: one company's own free seats, patched to departments and from
 * there to people, or straight to people and devices.
 *
 * A record of where seats are meant to go: it does not provision anything in
 * Microsoft, Google or any vendor console.
 */

const BOARD_KEY = ["/api/portal/admin/license-board"];
const companyKey = (id: string) => ["/api/portal/admin/license-board/clients", id];

function useErrorToast() {
  const { toast } = useToast();
  return (title: string, err: unknown) =>
    toast({ title, description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
}

function ColumnHeading({ icon: Icon, title, hint }: { icon: typeof Users; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#C4B5FD]" aria-hidden />
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-white/50">{hint}</p> : null}
      </div>
    </div>
  );
}

function SeatMeter({ free, total, toOrder }: { free: number; total: number; toOrder?: number }) {
  return (
    <p className="font-[Oxanium] text-xs tabular-nums text-white/60">
      <span className="text-white">{free}</span> free / {total}
      {toOrder ? <span className="ml-1.5 text-[#FBBF24]">· {toOrder} to order</span> : null}
    </p>
  );
}

/* ------------------------------------------------------------------ level 1 */

function PoolItemCard({ item, onChanged }: { item: Board["items"][number]; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(String(item.quantity));
  const fail = useErrorToast();
  const tone = toneFor(item.vendor.toLowerCase());
  return (
    <PatchCard id={`item:${item.id}`} className="p-2.5 pr-1.5 sm:p-3 sm:pr-2">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden h-10 w-1 shrink-0 rounded-full sm:block" style={{ background: PATCH_TONES[tone], boxShadow: `0 0 10px ${PATCH_TONES[tone]}` }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/50">{item.vendor}</p>
          <p className="line-clamp-2 hyphens-auto text-sm font-semibold leading-snug text-white" title={item.product}>
            {item.product}
          </p>
          {item.kind === "app" ? (
            <p className="font-[Oxanium] text-xs text-white/60">
              <span className="text-white">∞</span> app · on for {item.allocated} {item.allocated === 1 ? "company" : "companies"}
              {item.chocoPackage ? <span className="ml-1.5 font-mono text-[#6EE7B7]">choco {item.chocoPackage}</span> : null}
            </p>
          ) : editing ? (
            <form
              className="mt-1 flex items-center gap-1.5"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await licenseBoardApi.setQuantity(item.id, Number(qty) || 0);
                  setEditing(false);
                  onChanged();
                } catch (err) {
                  fail("Could not change the seats", err);
                }
              }}
            >
              <input
                type="number"
                min={item.allocated}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label={`Seats DE holds of ${item.product}`}
                className="h-8 w-20 rounded border border-white/20 bg-black/40 px-2 text-xs text-white"
              />
              <button type="submit" className="min-h-8 rounded px-2 text-xs font-semibold text-[#F04C97] hover:bg-white/10">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="min-h-8 rounded px-2 text-xs text-white/60 hover:bg-white/10">
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="text-left hover:underline" title="Change the seats DE holds">
              <SeatMeter free={item.free} total={item.quantity} toOrder={item.toOrder} />
            </button>
          )}
        </div>
        {item.allocated === 0 && item.toOrder === 0 ? (
          <button
            type="button"
            aria-label={`Remove ${item.product} from DE's pool`}
            onClick={async () => {
              try {
                await licenseBoardApi.removeItem(item.id);
                onChanged();
              } catch (err) {
                fail("Could not remove the licence", err);
              }
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded text-white/35 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
        <PatchJack
          source={`item:${item.id}`}
          label={item.product}
          tone={tone}
          hint={
            item.kind === "app"
              ? "An app: drop it on a company to turn it on there"
              : item.free > 0
                ? `${item.free} free in DE's pool`
                : "DE's pool is empty: drops are recorded to order"
          }
        />
      </div>
    </PatchCard>
  );
}

function CompanyCard({
  company,
  board,
  onOpen,
  onChanged,
}: {
  company: Board["clients"][number];
  board: Board;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const fail = useErrorToast();
  const byId = new Map(board.items.map((i) => [i.id, i]));
  return (
    <PatchCard id={`client:${company.id}`} className="px-3 py-2.5">
      <PatchTarget id={`client:${company.id}`} name={company.name} />
      <button type="button" onClick={onOpen} className="group flex w-full items-center gap-2 text-left">
        <Building2 className="hidden h-4 w-4 shrink-0 text-white/40 sm:block" aria-hidden />
        <span className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-white group-hover:text-[#F04C97]">{company.name}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white" aria-hidden />
      </button>
      {company.seats.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {company.seats.map((s) => {
            const item = byId.get(s.itemId);
            if (!item) return null;
            const color = PATCH_TONES[toneFor(item.vendor.toLowerCase())];
            return (
              <li
                key={s.itemId}
                className="flex min-w-0 max-w-full items-center gap-1 rounded-full border bg-black/30 py-0.5 pl-2 pr-0.5 text-xs text-white/80"
                style={{ borderColor: `${color}66` }}
              >
                <span className="min-w-0 max-w-[9rem] truncate" title={item.product}>
                  {item.product}
                </span>
                <span className="shrink-0 font-[Oxanium] tabular-nums" style={{ color }}>
                  {s.unlimited ? "on" : `${s.free}/${s.held}`}
                </span>
                <button
                  type="button"
                  disabled={!s.unlimited && s.free === 0}
                  aria-label={s.unlimited ? `Turn ${item.product} off for ${company.name}` : `Give one ${item.product} seat back from ${company.name}`}
                  title={s.unlimited ? "Turn the app off for this company" : s.free === 0 ? "Every seat is in use" : "Give one unused seat back"}
                  onClick={async () => {
                    try {
                      await licenseBoardApi.release(s.itemId, company.id);
                      onChanged();
                    } catch (err) {
                      fail("Could not release the seat", err);
                    }
                  }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <Minus className="h-3 w-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-0.5 text-xs text-white/40">Nothing patched yet</p>
      )}
    </PatchCard>
  );
}

function PoolLevel({ board, onOpenCompany }: { board: Board; onOpenCompany: (id: string) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fail = useErrorToast();
  const [filter, setFilter] = useState("");
  const [binOpen, setBinOpen] = useState(false);
  const licences = board.items.filter((i) => i.kind !== "app");
  const apps = board.items.filter((i) => i.kind === "app");
  const refresh = () => void qc.invalidateQueries({ queryKey: BOARD_KEY });

  const companies = board.clients.filter((c) => c.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const itemsById = useMemo(() => new Map(board.items.map((i) => [i.id, i])), [board.items]);

  const cables = useMemo<PatchCable[]>(
    () =>
      board.clients.flatMap((c) =>
        c.seats.flatMap((s) => {
          const item = itemsById.get(s.itemId);
          if (!item) return [];
          const tone = toneFor(item.vendor.toLowerCase());
          if (s.unlimited) return [{ id: `${c.id}:${s.itemId}`, from: `item:${s.itemId}`, to: `client:${c.id}`, tone }];
          const out: PatchCable[] = [];
          if (s.held - s.toOrder > 0)
            out.push({ id: `${c.id}:${s.itemId}`, from: `item:${s.itemId}`, to: `client:${c.id}`, tone, label: `×${s.held - s.toOrder}` });
          if (s.toOrder > 0)
            out.push({ id: `${c.id}:${s.itemId}:order`, from: `item:${s.itemId}`, to: `client:${c.id}`, tone: "amber", label: `+${s.toOrder}`, dashed: true });
          return out;
        }),
      ),
    [board.clients, itemsById],
  );

  const canPatch = useCallback((source: string, target: string) => source.startsWith("item:") && target.startsWith("client:"), []);
  const onPatch = useCallback(
    async (source: string, target: string) => {
      try {
        const r = await licenseBoardApi.allocate(source.slice(5), target.slice(7));
        toast({
          title: `${r.product} → ${r.company}`,
          description: r.app
            ? "Turned on for the company. Open it to send the app to people or every machine."
            : r.toOrder
              ? "DE's pool is empty for this licence: the seat is recorded to order from the vendor."
              : "One seat from DE's pool.",
        });
        refresh();
      } catch (err) {
        fail("Could not patch the seat", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const seatsHeld = licences.reduce((n, i) => n + i.quantity, 0);
  const seatsFree = licences.reduce((n, i) => n + i.free, 0);
  const toOrder = licences.reduce((n, i) => n + i.toOrder, 0);
  const chip = "inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setBinOpen(true)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-[#D3126A] px-3 text-sm font-semibold text-white hover:bg-[#A30E52]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add from catalog
        </button>
        <span className="hidden text-sm text-white/45 sm:inline">Licences, vendor SKUs, apps and agents</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={chip}>
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> {licences.length} licences · {seatsHeld} seats · {seatsFree} free
        </span>
        <span className={chip}>
          <AppWindow className="h-3.5 w-3.5" aria-hidden /> {apps.length} apps
        </span>
        <span className={chip}>
          <Building2 className="h-3.5 w-3.5" aria-hidden /> {board.clients.length} companies
        </span>
        {toOrder ? <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">{toOrder} seats to order</span> : null}
      </div>

      <Sheet open={binOpen} onOpenChange={setBinOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto border-white/10 bg-[#0a0714] text-white sm:max-w-2xl">
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-white">Add from catalog</SheetTitle>
            <SheetDescription className="text-white/55">Adds to DE's pool. Patch it onto companies from there.</SheetDescription>
          </SheetHeader>
          <PartsBin board={board} onAdded={refresh} />
        </SheetContent>
      </Sheet>

      <PatchBay cables={cables} canPatch={canPatch} onPatch={onPatch} layoutKey={`${filter}:${board.items.length}`}>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_200px_minmax(0,1fr)]">
          <section aria-label="DE licence pool">
            <ColumnHeading icon={Cpu} title="DE pool" hint="What DE holds. Drag from a jack onto a company." />
            {board.items.length === 0 ? (
              <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-white/60">
                <p>DE's pool is empty.</p>
                <button type="button" onClick={() => setBinOpen(true)} className="mt-2 font-semibold text-[#F04C97] hover:underline">
                  Add from catalog
                </button>
              </div>
            ) : null}
            {licences.length ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50">Licences</p>
                {licences.map((item) => (
                  <PoolItemCard key={item.id} item={item} onChanged={refresh} />
                ))}
              </div>
            ) : null}
            {apps.length ? (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold text-white/50">Apps</p>
                {apps.map((item) => (
                  <PoolItemCard key={item.id} item={item} onChanged={refresh} />
                ))}
              </div>
            ) : null}
          </section>
          <div aria-hidden />
          <section aria-label="Client companies">
            <ColumnHeading icon={Building2} title="Companies" hint="Drop a cable on a company. Click a name to open it." />
            <label className="relative mb-2 block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a company"
                aria-label="Find a company"
                className="h-10 w-full rounded-md border border-white/15 bg-black/30 pl-8 pr-3 text-sm text-white placeholder:text-white/35"
              />
            </label>
            <div className="space-y-2">
              {companies.map((c) => (
                <CompanyCard key={c.id} company={c} board={board} onOpen={() => onOpenCompany(c.id)} onChanged={refresh} />
              ))}
              {companies.length === 0 ? <p className="text-sm text-white/50">No company matches.</p> : null}
            </div>
          </section>
        </div>
      </PatchBay>
    </div>
  );
}

/* ------------------------------------------------------------------ level 2 */

function HeldChips({
  licenses,
  data,
  onRemove,
}: {
  licenses: CompanyBoard["people"][number]["licenses"];
  data: CompanyBoard;
  onRemove: (assignmentId: string) => void;
}) {
  if (!licenses.length) return null;
  const byId = new Map(data.pool.map((p) => [p.itemId, p]));
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {licenses.map((l) => {
        const item = byId.get(l.itemId);
        const color = PATCH_TONES[toneFor((item?.vendor || "").toLowerCase())];
        return (
          <li key={l.assignmentId} className="flex min-w-0 max-w-full items-center gap-0.5 rounded-full border bg-black/30 py-0.5 pl-2 pr-0.5 text-[11px] text-white/80" style={{ borderColor: `${color}66` }}>
            <span className="min-w-0 max-w-[8rem] truncate">{item?.product || "Licence"}</span>
            <button
              type="button"
              onClick={() => onRemove(l.assignmentId)}
              aria-label={`Unassign ${item?.product || "licence"}`}
              className="grid h-6 w-6 place-items-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CompanyLevel({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fail = useErrorToast();
  const q = useQuery({ queryKey: companyKey(clientId), queryFn: () => licenseBoardApi.company(clientId) });
  const jc = useJumpCloud(clientId);
  const [tab, setTab] = useState("patch");
  const [newDevices, setNewDevices] = useState<string[]>([]);
  const [deviceName, setDeviceName] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: companyKey(clientId) });
    void qc.invalidateQueries({ queryKey: BOARD_KEY });
    void qc.invalidateQueries({ queryKey: jumpcloudKey(clientId) });
  };
  const data = q.data;

  const devices = useMemo(() => {
    const known = data?.devices ?? [];
    const extra = newDevices
      .filter((label) => !known.some((d) => d.id === deviceTargetId(label)))
      .map((label) => ({ id: deviceTargetId(label), label, licenses: [] }));
    return [...known, ...extra];
  }, [data?.devices, newDevices]);

  const toneOf = useCallback(
    (itemId: string) => toneFor((data?.pool.find((p) => p.itemId === itemId)?.vendor || "").toLowerCase()),
    [data?.pool],
  );

  const cables = useMemo<PatchCable[]>(() => {
    if (!data) return [];
    const out: PatchCable[] = [];
    const bundle = new Map<string, PatchCable & { n: number }>();
    const add = (from: string, to: string, itemId: string) => {
      const key = `${from}>${to}>${itemId}`;
      const c = bundle.get(key);
      if (c) c.n++;
      else bundle.set(key, { id: key, from, to, tone: toneOf(itemId), n: 1 });
    };
    for (const d of data.departments) for (const s of d.seats) for (let i = 0; i < s.count; i++) add(`item:${s.itemId}`, `dept:${d.id}`, s.itemId);
    for (const p of data.people)
      for (const l of p.licenses) add(l.viaDepartmentId ? `dept:${l.viaDepartmentId}` : `item:${l.itemId}`, `user:${p.id}`, l.itemId);
    for (const d of devices) for (const l of d.licenses) add(l.viaDepartmentId ? `dept:${l.viaDepartmentId}` : `item:${l.itemId}`, `device:${d.id}`, l.itemId);
    for (const c of Array.from(bundle.values())) out.push({ ...c, label: c.n > 1 ? `×${c.n}` : undefined });
    return out;
  }, [data, devices, toneOf]);

  const appIds = useMemo(() => new Set((data?.pool ?? []).filter((p) => p.kind === "app").map((p) => p.itemId)), [data?.pool]);
  const canPatch = useCallback(
    (source: string, target: string) => {
      const everyMachine = target === `device:${EVERY_MACHINE_ID}`;
      if (source.startsWith("item:")) {
        // Apps go to people and machines (every machine too); counted licences never to "every machine".
        if (appIds.has(source.slice(5))) return /^(user|device):/.test(target);
        return /^(dept|user|device):/.test(target) && !everyMachine;
      }
      if (source.startsWith("seat:")) return /^(user|device):/.test(target) && !everyMachine;
      return false;
    },
    [appIds],
  );

  const onPatch = useCallback(
    async (source: string, target: string) => {
      if (!data) return;
      const [kind, ...rest] = source.split(":");
      const itemId = kind === "item" ? rest.join(":") : rest[1];
      const fromDepartmentId = kind === "seat" ? rest[0] : undefined;
      const colon = target.indexOf(":");
      const targetKind = target.slice(0, colon);
      const targetId = target.slice(colon + 1);
      const targetType = targetKind === "dept" ? "department" : (targetKind as "user" | "device");
      const label = targetType === "device" ? devices.find((d) => d.id === targetId)?.label : undefined;
      try {
        await licenseBoardApi.assign(clientId, { itemId, targetType, targetId, label, fromDepartmentId });
        refresh();
      } catch (err) {
        fail("Could not patch the seat", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, devices, clientId],
  );

  const unassign = async (assignmentId: string) => {
    try {
      const r = await licenseBoardApi.unassign(clientId, assignmentId);
      toast({ title: r.returnedTo === "department" ? "Seat back in its department" : "Seat back in the company pool" });
      refresh();
    } catch (err) {
      fail("Could not unassign the seat", err);
    }
  };

  if (q.isLoading) return <Skeleton className="h-96 rounded-xl" />;
  if (q.isError || !data) {
    return <Callout tone="bad" title="This company couldn't be loaded">{q.error instanceof Error ? q.error.message : ""}</Callout>;
  }

  const people = data.people.filter((p) => `${p.name} ${p.email}`.toLowerCase().includes(personFilter.trim().toLowerCase()));
  const deptName = new Map(data.departments.map((d) => [d.id, d.name]));
  const itemById = new Map(data.pool.map((p) => [p.itemId, p]));

  const poolColumn = (
    <section aria-label={`${data.company.name} licence pool`}>
      <ColumnHeading icon={Cpu} title="Company pool" hint="Only seats this company holds." />
      {data.pool.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-3 text-sm text-white/55">
          No seats yet. Go back and patch a licence onto {data.company.name}.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.pool.map((p) => (
            <PatchCard key={p.itemId} id={`item:${p.itemId}`} className="p-3 pr-2">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/50">{p.vendor}</p>
                  <p className="line-clamp-2 hyphens-auto text-sm font-semibold leading-snug text-white" title={p.product}>
                    {p.product}
                  </p>
                  {p.unlimited ? (
                    <p className="font-[Oxanium] text-xs text-white/60">
                      <span className="text-white">∞</span> app · on {p.assigned} {p.assigned === 1 ? "target" : "targets"}
                      {p.chocoPackage ? <span className="ml-1.5 font-mono text-[#6EE7B7]">choco {p.chocoPackage}</span> : null}
                    </p>
                  ) : (
                    <SeatMeter free={p.free} total={p.held} toOrder={p.toOrder} />
                  )}
                </div>
                <PatchJack
                  source={`item:${p.itemId}`}
                  label={p.product}
                  tone={toneOf(p.itemId)}
                  disabled={!p.unlimited && p.free === 0}
                  hint={p.unlimited ? "An app: send it to people, machines or every machine" : p.free === 0 ? "No free seats in this company's pool" : `${p.free} free`}
                />
              </div>
            </PatchCard>
          ))}
        </div>
      )}
    </section>
  );

  const deptColumn = (
    <section aria-label="Departments">
      <ColumnHeading icon={Users} title="Departments" hint="Park seats in a department, then patch them to its people." />
      {data.departments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-3 text-sm text-white/55">
          {data.company.name} has no departments. Patch seats straight to people.
        </p>
      ) : (
        <div className="space-y-2.5">
          {data.departments.map((d) => (
            <PatchCard key={d.id} id={`dept:${d.id}`} className="p-3 pl-4">
              <PatchTarget id={`dept:${d.id}`} name={d.name} />
              <p className="truncate text-sm font-semibold text-white">{d.name}</p>
              {d.seats.length === 0 ? (
                <p className="text-xs text-white/40">No seats parked</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {d.seats.map((s) => (
                    <li key={s.itemId} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-xs text-white/75">
                        {itemById.get(s.itemId)?.product || "Licence"}{" "}
                        <span className="font-[Oxanium] tabular-nums text-white">×{s.count}</span>
                      </span>
                      <PatchJack
                        size="sm"
                        source={`seat:${d.id}:${s.itemId}`}
                        label={`${itemById.get(s.itemId)?.product || "Licence"} from ${d.name}`}
                        tone={toneOf(s.itemId)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </PatchCard>
          ))}
        </div>
      )}
    </section>
  );

  const peopleColumn = (
    <section aria-label="People and devices" className="space-y-6">
      <div>
        <ColumnHeading icon={Users} title="People" />
        <label className="relative mb-2.5 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" aria-hidden />
          <input
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            placeholder="Find a person"
            aria-label="Find a person"
            className="h-10 w-full rounded-md border border-white/15 bg-black/30 pl-8 pr-3 text-sm text-white placeholder:text-white/35"
          />
        </label>
        <div className="space-y-2">
          {people.map((p) => (
            <PatchCard key={p.id} id={`user:${p.id}`} className="p-2.5 pl-4">
              <PatchTarget id={`user:${p.id}`} name={p.name} />
              <p className="truncate text-sm font-semibold text-white">{p.name}</p>
              <p className="truncate text-xs text-white/45">
                {p.departmentId && deptName.get(p.departmentId) ? `${deptName.get(p.departmentId)} · ` : ""}
                {p.email}
              </p>
              <HeldChips licenses={p.licenses} data={data} onRemove={(id) => void unassign(id)} />
            </PatchCard>
          ))}
          {people.length === 0 ? <p className="text-sm text-white/50">No active people{personFilter ? " match" : ""}.</p> : null}
        </div>
      </div>
      <div>
        <ColumnHeading icon={Cpu} title="Devices" hint="Machine-licensed products (EDR, RMM) and apps. Every machine is the baseline." />
        <div className="space-y-2">
          {devices.map((d) => (
            <PatchCard
              key={d.id}
              id={`device:${d.id}`}
              className={`p-2.5 pl-4 ${d.id === EVERY_MACHINE_ID ? "border-[#34D399]/40 bg-gradient-to-r from-[#34D399]/[0.07] to-transparent" : ""}`}
            >
              <PatchTarget id={`device:${d.id}`} name={d.label} />
              {d.id === EVERY_MACHINE_ID ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Monitor className="h-4 w-4 text-[#6EE7B7]" aria-hidden /> Every machine
                  </p>
                  <p className="text-xs text-white/45">The baseline: apps every machine in {data.company.name} gets.</p>
                </>
              ) : (
                <p className="truncate font-[Oxanium] text-sm text-white">{d.label}</p>
              )}
              {d.licenses.length === 0 && d.id !== EVERY_MACHINE_ID ? (
                <p className="text-xs text-white/40">Patch a licence here to save it</p>
              ) : null}
              <HeldChips licenses={d.licenses} data={data} onRemove={(id) => void unassign(id)} />
            </PatchCard>
          ))}
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const label = deviceName.trim();
              if (label) setNewDevices((prev) => (prev.includes(label) ? prev : [...prev, label]));
              setDeviceName("");
            }}
          >
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Device name"
              aria-label="Device name"
              className="h-10 w-full min-w-0 rounded-md border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/35 sm:flex-1"
            />
            <button type="submit" className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-white/15 px-3 text-sm font-semibold text-white hover:bg-white/10">
              <Plus className="h-4 w-4" aria-hidden /> Add
            </button>
          </form>
        </div>
      </div>
    </section>
  );

  const held = data.pool.filter((p) => !p.unlimited).reduce((n, p) => n + p.held, 0);
  const free = data.pool.filter((p) => !p.unlimited).reduce((n, p) => n + p.free, 0);
  const appsOn = data.pool.filter((p) => p.unlimited).length;
  const jcState = jumpcloudState(jc.data);
  const chip = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs";
  const chipTone = {
    good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    muted: "border-white/15 bg-white/5 text-white/70",
  } as const;
  const tabTrigger =
    "rounded-none border-b-2 border-transparent bg-transparent px-3 pb-2.5 pt-1 text-sm text-white/60 hover:text-white data-[state=active]:border-[#F04C97] data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none";

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-white/55">
        <button type="button" onClick={onBack} className="rounded hover:text-white hover:underline">
          License Patch Bay
        </button>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        <span className="truncate text-white/85">{data.company.name}</span>
      </nav>
      <header className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white/10">
          <Building2 className="h-5 w-5 text-[#C4B5FD]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-white">{data.company.name}</h2>
          <p className="text-sm text-white/55">
            Company · {data.people.length} {data.people.length === 1 ? "person" : "people"} · {data.departments.length}{" "}
            {data.departments.length === 1 ? "department" : "departments"}
          </p>
        </div>
      </header>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`${chip} ${chipTone.muted}`}>
          <KeyRound className="h-3.5 w-3.5" aria-hidden /> {held} seats · {free} free
        </span>
        <span className={`${chip} ${chipTone.muted}`}>
          <AppWindow className="h-3.5 w-3.5" aria-hidden /> {appsOn} apps on
        </span>
        <button type="button" onClick={() => setTab("jumpcloud")} className={`${chip} ${chipTone[jcState.tone]} hover:bg-white/10`}>
          {jcState.label}
        </button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-white/10 bg-transparent p-0">
          <TabsTrigger value="patch" className={tabTrigger}>
            Patch bay
          </TabsTrigger>
          <TabsTrigger value="kit" className={tabTrigger}>
            Starter kit
          </TabsTrigger>
          <TabsTrigger value="jumpcloud" className={tabTrigger}>
            JumpCloud installs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="patch" className="mt-5">
          <PatchBay
            cables={cables}
            canPatch={canPatch}
            onPatch={onPatch}
            layoutKey={`${personFilter}:${devices.length}:${data.people.length}`}
          >
            {/* Phones: pool and departments share the left column, people and devices the right. */}
            <div className="grid grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)_88px_minmax(0,1fr)]">
              <div className="space-y-6 lg:contents">
                {poolColumn}
                <div className="hidden lg:block" aria-hidden />
                {deptColumn}
              </div>
              <div aria-hidden className="lg:hidden" />
              <div className="hidden lg:block" aria-hidden />
              {peopleColumn}
            </div>
          </PatchBay>
        </TabsContent>
        <TabsContent value="kit" className="mt-5">
          <StarterKitTab clientId={clientId} companyName={data.company.name} onApplied={refresh} />
        </TabsContent>
        <TabsContent value="jumpcloud" className="mt-5">
          <JumpCloudTab clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdminLicenseBoard() {
  const q = useQuery({ queryKey: BOARD_KEY, queryFn: licenseBoardApi.board });
  const [openCompany, setOpenCompany] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get("company");
    } catch {
      return null;
    }
  });
  const open = (id: string | null) => {
    setOpenCompany(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("company", id);
    else url.searchParams.delete("company");
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  };

  return (
    <PortalLayout
      title="License Patch Bay"
      description="Patch vendor licences from DE's pool into companies, then into departments, people and devices. A record of where seats go: it does not assign licences in Microsoft, Google or other vendor consoles."
      width="full"
    >
      <div className="rounded-lg border border-white/10 bg-[#0a0714] p-3 text-white sm:p-5">
        {q.isLoading ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : q.isError || !q.data ? (
          <Callout tone="bad" title="The patch bay couldn't be loaded">{q.error instanceof Error ? q.error.message : ""}</Callout>
        ) : openCompany ? (
          <CompanyLevel clientId={openCompany} onBack={() => open(null)} />
        ) : (
          <PoolLevel board={q.data} onOpenCompany={open} />
        )}
      </div>
    </PortalLayout>
  );
}
