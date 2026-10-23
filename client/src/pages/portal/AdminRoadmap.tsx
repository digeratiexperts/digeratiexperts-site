import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Field, Panel } from "@/components/portal/ui";
import { RoadmapItemCard } from "@/components/portal/roadmap/RoadmapItemCard";
import { portalGet } from "@/lib/portalApi";
import { ROADMAP_QUERY_KEY, RoadmapApiError, adminRoadmapKey, roadmapApi } from "@/lib/roadmapApi";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  ROADMAP_CATEGORIES,
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  STATUS_LABELS,
  type RoadmapCategory,
  type RoadmapItem,
  type RoadmapItemInput,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@shared/roadmap";
import { PortalLayout } from "./PortalLayout";

/** DE admin: write and maintain each client company's IT roadmap. Owners decide on /portal/roadmap. */

type Tenant = { id: string; companyName: string; type: "msp" | "client" };
const selectClass = "h-10 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground";

function nextQuarter(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 2;
  return q > 4 ? `${d.getFullYear() + 1}-Q1` : `${d.getFullYear()}-Q${q}`;
}

type Draft = {
  title: string;
  rationale: string;
  category: RoadmapCategory;
  priority: RoadmapPriority;
  targetQuarter: string;
  estimateLow: string;
  estimateHigh: string;
  costBasis: "one_time" | "yearly";
  status: RoadmapStatus;
};
const blank = (): Draft => ({
  title: "",
  rationale: "",
  category: "security",
  priority: "medium",
  targetQuarter: nextQuarter(),
  estimateLow: "",
  estimateHigh: "",
  costBasis: "one_time",
  status: "proposed",
});
const fromItem = (i: RoadmapItem): Draft => ({
  title: i.title,
  rationale: i.rationale,
  category: i.category,
  priority: i.priority,
  targetQuarter: i.targetQuarter,
  estimateLow: i.estimateLow == null ? "" : String(i.estimateLow),
  estimateHigh: i.estimateHigh == null ? "" : String(i.estimateHigh),
  costBasis: i.costBasis,
  status: i.status,
});
const num = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[$,\s]/g, ""))));
const toInput = (d: Draft): RoadmapItemInput => ({
  title: d.title,
  rationale: d.rationale,
  category: d.category,
  priority: d.priority,
  targetQuarter: d.targetQuarter.trim(),
  estimateLow: num(d.estimateLow),
  estimateHigh: num(d.estimateHigh),
  costBasis: d.costBasis,
  status: d.status,
});

function ItemForm({ companyId, editing, onDone }: { companyId: string; editing: RoadmapItem | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => (editing ? fromItem(editing) : blank()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => (editing ? roadmapApi.edit(companyId, editing.id, toInput(d)) : roadmapApi.create(companyId, toInput(d))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminRoadmapKey(companyId) });
      void qc.invalidateQueries({ queryKey: ROADMAP_QUERY_KEY });
      setD(blank());
      setErrors({});
      setFormError(null);
      onDone();
    },
    onError: (e) => {
      setErrors(e instanceof RoadmapApiError ? e.fieldErrors : {});
      setFormError(e instanceof Error ? e.message : "Could not save");
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <Panel id="roadmap-form" title={editing ? "Edit item" : "Add an item"} description="Owners see it on IT Roadmap and approve or decline proposals.">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor="rm-title" required error={errors.title} className="md:col-span-2">
          <Input id="rm-title" value={d.title} maxLength={160} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Why it matters" htmlFor="rm-why" error={errors.rationale} hint="In the owner's terms: the risk, the cost of waiting, the benefit." className="md:col-span-2">
          <Textarea id="rm-why" rows={3} value={d.rationale} maxLength={4000} onChange={(e) => set("rationale", e.target.value)} />
        </Field>
        <Field label="Category" htmlFor="rm-cat" error={errors.category}>
          <select id="rm-cat" className={selectClass} value={d.category} onChange={(e) => set("category", e.target.value as RoadmapCategory)}>
            {ROADMAP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="rm-pri" error={errors.priority}>
          <select id="rm-pri" className={selectClass} value={d.priority} onChange={(e) => set("priority", e.target.value as RoadmapPriority)}>
            {ROADMAP_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target quarter" htmlFor="rm-q" required error={errors.targetQuarter} hint="Like 2027-Q1">
          <Input id="rm-q" value={d.targetQuarter} maxLength={7} onChange={(e) => set("targetQuarter", e.target.value)} />
        </Field>
        <Field label="Status" htmlFor="rm-status" error={errors.status} hint="Owners approve or decline proposals; you move approved work forward.">
          <select id="rm-status" className={selectClass} value={d.status} onChange={(e) => set("status", e.target.value as RoadmapStatus)}>
            {ROADMAP_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimate from ($)" htmlFor="rm-lo" error={errors.estimateLow}>
            <Input id="rm-lo" inputMode="numeric" value={d.estimateLow} onChange={(e) => set("estimateLow", e.target.value)} />
          </Field>
          <Field label="Estimate to ($)" htmlFor="rm-hi" error={errors.estimateHigh}>
            <Input id="rm-hi" inputMode="numeric" value={d.estimateHigh} onChange={(e) => set("estimateHigh", e.target.value)} />
          </Field>
        </div>
        <Field label="Cost is" htmlFor="rm-basis">
          <select id="rm-basis" className={selectClass} value={d.costBasis} onChange={(e) => set("costBasis", e.target.value as Draft["costBasis"])}>
            <option value="one_time">One-off</option>
            <option value="yearly">Per year</option>
          </select>
        </Field>
        {formError && <Callout tone="bad" title={formError} className="md:col-span-2" />}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={save.isPending} data-testid="roadmap-save">
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add item"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}

function AdminActions({ companyId, item, onEdit }: { companyId: string; item: RoadmapItem; onEdit: () => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => roadmapApi.remove(companyId, item.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminRoadmapKey(companyId) });
      void qc.invalidateQueries({ queryKey: ROADMAP_QUERY_KEY });
    },
  });
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onEdit}>
        Edit
      </Button>
      {confirm ? (
        <>
          <Button type="button" size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate()}>
            Delete for good
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(false)}>
            Keep
          </Button>
        </>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(true)}>
          Delete
        </Button>
      )}
    </div>
  );
}

export default function AdminRoadmap() {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState("");
  const [editing, setEditing] = useState<RoadmapItem | null>(null);
  const tenants = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/portal/admin/tenants"],
    queryFn: () => portalGet<{ tenants: Tenant[] }>("/api/portal/admin/tenants"),
    staleTime: 60_000,
  });
  const clients = useMemo(() => (tenants.data?.tenants ?? []).filter((t) => t.type === "client"), [tenants.data]);
  const roadmap = useQuery({ queryKey: adminRoadmapKey(companyId), queryFn: () => roadmapApi.adminView(companyId), enabled: Boolean(companyId) });
  const items = roadmap.data?.items ?? [];

  return (
    <PortalLayout title="Roadmaps" description="Write each client's IT roadmap. Their owners see it, comment, and approve or decline proposals.">
      <div className="space-y-4">
        <Panel id="roadmap-company">
          <Field label="Company" htmlFor="rm-company">
            <select
              id="rm-company"
              className={selectClass}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setEditing(null);
              }}
              data-testid="roadmap-company"
            >
              <option value="">{tenants.isPending ? "Loading companies…" : "Choose a company…"}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </Field>
        </Panel>

        {companyId && (
          <>
            <ItemForm key={`${companyId}-${editing?.id ?? "new"}`} companyId={companyId} editing={editing} onDone={() => setEditing(null)} />
            <Panel id="roadmap-list" title={`${roadmap.data?.company.name ?? "Company"} roadmap`} description="By quarter, then priority" flush>
              {roadmap.isError ? (
                <div className="p-4">
                  <Callout tone="bad" title="The roadmap couldn't be loaded">
                    {roadmap.error instanceof Error ? roadmap.error.message : ""}
                  </Callout>
                </div>
              ) : roadmap.isPending ? (
                <div className="p-4">
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              ) : items.length === 0 ? (
                <EmptyState icon={Map} title="No items yet" description="Add the first one above. The company's owners see the roadmap once it has an item." compact />
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <RoadmapItemCard
                      key={item.id}
                      item={item}
                      onComment={async (body) => {
                        await roadmapApi.adminComment(companyId, item.id, body);
                        void qc.invalidateQueries({ queryKey: adminRoadmapKey(companyId) });
                      }}
                      actions={
                        <AdminActions
                          companyId={companyId}
                          item={item}
                          onEdit={() => {
                            setEditing(item);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        />
                      }
                    />
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
