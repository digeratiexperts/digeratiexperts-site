import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Field, Panel, Token } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { REVIEWS_QUERY_KEY, ReviewsApiError, adminReviewsKey, reviewsApi } from "@/lib/reviewsApi";
import { adminRoadmapKey, roadmapApi } from "@/lib/roadmapApi";
import { formatMeetingDay, type BusinessReview, type ReviewInput } from "@shared/businessReviews";
import { formatQuarter } from "@shared/roadmap";
import { PortalLayout } from "./PortalLayout";

/** DE admin: write, publish and maintain each client's business reviews. Owners read them on /portal/qbr. */

type Tenant = { id: string; companyName: string; type: "msp" | "client" };
type TenantFile = { id: string; originalName?: string; fileName?: string };
const selectClass = "h-10 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground";
const today = () => new Date().toISOString().slice(0, 10);

type Draft = { title: string; period: string; meetingOn: string; status: "draft" | "published"; summary: string; decisions: string; roadmapItemIds: string[]; fileId: string };
const blank = (): Draft => ({ title: "", period: "", meetingOn: today(), status: "draft", summary: "", decisions: "", roadmapItemIds: [], fileId: "" });
const fromReview = (r: BusinessReview): Draft => ({
  title: r.title,
  period: r.period ?? "",
  meetingOn: r.meetingOn,
  status: r.status,
  summary: r.summary,
  decisions: r.decisions.join("\n"),
  roadmapItemIds: r.roadmapItemIds,
  fileId: r.fileId ?? "",
});
const toInput = (d: Draft): ReviewInput => ({
  title: d.title,
  period: d.period.trim() || null,
  meetingOn: d.meetingOn,
  status: d.status,
  summary: d.summary,
  decisions: d.decisions.split("\n").map((s) => s.trim()).filter(Boolean),
  roadmapItemIds: d.roadmapItemIds,
  fileId: d.fileId || null,
});

function ReviewForm({ companyId, editing, onDone }: { companyId: string; editing: BusinessReview | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<Draft>(() => (editing ? fromReview(editing) : blank()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const roadmap = useQuery({ queryKey: adminRoadmapKey(companyId), queryFn: () => roadmapApi.adminView(companyId) });
  const files = useQuery({
    queryKey: ["/api/portal/admin/companies", companyId, "files"],
    queryFn: () => portalGet<{ files: TenantFile[] } | TenantFile[]>(`/api/portal/admin/companies/${encodeURIComponent(companyId)}/files`),
  });
  const fileList: TenantFile[] = Array.isArray(files.data) ? files.data : files.data?.files ?? [];

  const save = useMutation({
    mutationFn: () => (editing ? reviewsApi.edit(companyId, editing.id, toInput(d)) : reviewsApi.create(companyId, toInput(d))),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminReviewsKey(companyId) });
      void qc.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY });
      setD(blank());
      setErrors({});
      setFormError(null);
      onDone();
    },
    onError: (e) => {
      setErrors(e instanceof ReviewsApiError ? e.fieldErrors : {});
      setFormError(e instanceof Error ? e.message : "Could not save");
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const toggleItem = (id: string) =>
    set("roadmapItemIds", d.roadmapItemIds.includes(id) ? d.roadmapItemIds.filter((x) => x !== id) : [...d.roadmapItemIds, id]);

  return (
    <Panel id="review-form" title={editing ? "Edit review" : "Add a review"} description="Owners see published reviews on Business Reviews. Drafts stay with DE.">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
        <Field label="Title" htmlFor="rv-title" required error={errors.title} className="md:col-span-2">
          <Input id="rv-title" value={d.title} maxLength={160} placeholder="Q3 2026 business review" onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Meeting date" htmlFor="rv-date" required error={errors.meetingOn}>
          <Input id="rv-date" type="date" value={d.meetingOn} onChange={(e) => set("meetingOn", e.target.value)} />
        </Field>
        <Field label="Quarter covered" htmlFor="rv-period" error={errors.period} hint="Optional, like 2026-Q3">
          <Input id="rv-period" value={d.period} maxLength={7} onChange={(e) => set("period", e.target.value)} />
        </Field>
        <Field label="Summary" htmlFor="rv-summary" error={errors.summary} className="md:col-span-2">
          <Textarea id="rv-summary" rows={4} value={d.summary} maxLength={8000} onChange={(e) => set("summary", e.target.value)} />
        </Field>
        <Field label="Decisions" htmlFor="rv-decisions" error={errors.decisions} hint="One per line" className="md:col-span-2">
          <Textarea id="rv-decisions" rows={3} value={d.decisions} onChange={(e) => set("decisions", e.target.value)} />
        </Field>
        <fieldset className="md:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">Roadmap items discussed</legend>
          {roadmap.isPending ? (
            <Skeleton className="h-10 rounded-md" />
          ) : (roadmap.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">This company has no roadmap items yet.</p>
          ) : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {(roadmap.data?.items ?? []).map((i) => (
                <li key={i.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={d.roadmapItemIds.includes(i.id)} onChange={() => toggleItem(i.id)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    {i.title} <span className="text-xs text-muted-foreground">({formatQuarter(i.targetQuarter)})</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {errors.roadmapItemIds && (
            <p className="pt-ink pt-tone-bad mt-1 text-xs" role="alert">
              {errors.roadmapItemIds}
            </p>
          )}
        </fieldset>
        <Field label="Report file" htmlFor="rv-file" error={errors.fileId} hint="Upload it to the company's files first">
          <select id="rv-file" className={selectClass} value={d.fileId} onChange={(e) => set("fileId", e.target.value)}>
            <option value="">No report</option>
            {fileList.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.originalName || f.fileName || f.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="rv-status">
          <select id="rv-status" className={selectClass} value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
            <option value="draft">Draft (DE only)</option>
            <option value="published">Published to owners</option>
          </select>
        </Field>
        {formError && <Callout tone="bad" title={formError} className="md:col-span-2" />}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={save.isPending} data-testid="review-save">
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Add review"}
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

function ReviewRow({ companyId, review, onEdit }: { companyId: string; review: BusinessReview; onEdit: () => void }) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const remove = useMutation({
    mutationFn: () => reviewsApi.remove(companyId, review.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminReviewsKey(companyId) });
      void qc.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY });
    },
  });
  return (
    <li className="space-y-2 px-4 py-4 md:px-5" data-testid={`admin-review-${review.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{review.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatMeetingDay(review.meetingOn)} · {review.decisions.length} {review.decisions.length === 1 ? "decision" : "decisions"} · {review.roadmapItemIds.length} roadmap {review.roadmapItemIds.length === 1 ? "item" : "items"}
            {review.fileId ? " · report attached" : ""}
          </p>
        </div>
        <Token label={review.status === "published" ? "Published" : "Draft"} tone={review.status === "published" ? "ok" : "neutral"} dot />
      </div>
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
    </li>
  );
}

export default function AdminBusinessReviews() {
  const [companyId, setCompanyId] = useState("");
  const [editing, setEditing] = useState<BusinessReview | null>(null);
  const tenants = useQuery<{ tenants: Tenant[] }>({
    queryKey: ["/api/portal/admin/tenants"],
    queryFn: () => portalGet<{ tenants: Tenant[] }>("/api/portal/admin/tenants"),
    staleTime: 60_000,
  });
  const clients = useMemo(() => (tenants.data?.tenants ?? []).filter((t) => t.type === "client"), [tenants.data]);
  const list = useQuery({ queryKey: adminReviewsKey(companyId), queryFn: () => reviewsApi.adminList(companyId), enabled: Boolean(companyId) });
  const reviews = list.data?.reviews ?? [];

  return (
    <PortalLayout title="Business reviews" description="Write each client's review after the meeting. Their owners see it once you publish.">
      <div className="space-y-4">
        <Panel id="review-company">
          <Field label="Company" htmlFor="rv-company">
            <select
              id="rv-company"
              className={selectClass}
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setEditing(null);
              }}
              data-testid="review-company"
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
            <ReviewForm key={`${companyId}-${editing?.id ?? "new"}`} companyId={companyId} editing={editing} onDone={() => setEditing(null)} />
            <Panel id="review-list" title={`${list.data?.company.name ?? "Company"} reviews`} description="Newest meeting first" flush>
              {list.isError ? (
                <div className="p-4">
                  <Callout tone="bad" title="Reviews couldn't be loaded">
                    {list.error instanceof Error ? list.error.message : ""}
                  </Callout>
                </div>
              ) : list.isPending ? (
                <div className="p-4">
                  <Skeleton className="h-24 rounded-xl" />
                </div>
              ) : reviews.length === 0 ? (
                <EmptyState icon={BarChart3} title="No reviews yet" description="Add the first one above after your next meeting." compact />
              ) : (
                <ul className="divide-y divide-border">
                  {reviews.map((r) => (
                    <ReviewRow
                      key={r.id}
                      companyId={companyId}
                      review={r}
                      onEdit={() => {
                        setEditing(r);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
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
