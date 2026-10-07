import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout, Token } from "@/components/portal/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { KbBody } from "@/components/portal/kb/KbRenderer";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { KB_CATEGORIES, type KbArticleSummary } from "@shared/kb";

/**
 * Knowledge base authoring (DE admin). Write in the article dialect
 * (shared/kb.ts) with a live preview; save as draft or publish; target all
 * clients or one company. Saving a published article emails its subscribers.
 */

type AdminArticle = KbArticleSummary & { body: string; audienceClientId: string | null };
type Draft = { id?: string; title: string; summary: string; category: string; tags: string; body: string; status: "draft" | "published"; audienceClientId: string; notifySubscribers: boolean };

const BLANK: Draft = {
  title: "",
  summary: "",
  category: KB_CATEGORIES[0],
  tags: "",
  body: "# Introduction\nWhat this article helps with.\n\n# Instructions\n1. First step\n2. Second step\n",
  status: "draft",
  audienceClientId: "",
  notifySubscribers: true,
};

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CHEATSHEET = [
  ["# Heading", "section heading"],
  ["**bold**  *italic*  `code`", "inline styles"],
  ["- item / 1. item", "lists (indent 2 spaces to nest)"],
  ["| A | B |\\n|---|---|\\n| 1 | 2 |", "table with dark header"],
  ["> note  /  > ! warning", "callouts"],
  ["[text](/portal/requests)", "links (portal paths, https, mailto)"],
  ["{{license-policy}}", "the reader's live company licence policy"],
];

export default function AdminKb() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["/api/portal/admin/kb"], queryFn: () => portalGet<{ articles: AdminArticle[] }>("/api/portal/admin/kb") });
  const clients = useQuery({ queryKey: ["/api/portal/admin/companies"], queryFn: () => portalGet<any>("/api/portal/admin/companies").catch(() => []) });
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [state, setState] = useState<{ saving: boolean; msg?: string; error?: string }>({ saving: false });
  const [filter, setFilter] = useState("");

  const companyList: Array<{ id: string; name: string }> = (Array.isArray(clients.data) ? clients.data : clients.data?.companies ?? []).map((c: any) => ({
    id: c.id,
    name: c.companyName ?? c.name ?? c.id,
  }));

  const open = (a: AdminArticle) =>
    setDraft({
      id: a.id,
      title: a.title,
      summary: a.summary,
      category: a.category,
      tags: a.tags.join(", "),
      body: a.body,
      status: a.status,
      audienceClientId: a.audienceClientId ?? "",
      notifySubscribers: true,
    });

  useEffect(() => setState({ saving: false }), [draft.id]);

  const save = async () => {
    setState({ saving: true });
    const payload = {
      title: draft.title,
      summary: draft.summary,
      category: draft.category,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      body: draft.body,
      status: draft.status,
      audienceClientId: draft.audienceClientId || null,
      notifySubscribers: draft.notifySubscribers,
    };
    const res = await portalFetch(draft.id ? `/api/portal/admin/kb/${draft.id}` : "/api/portal/admin/kb", {
      method: draft.id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setState({ saving: false, error: body.error || "Couldn't save" });
    void qc.invalidateQueries({ queryKey: ["/api/portal/admin/kb"] });
    void qc.invalidateQueries({ queryKey: ["/api/portal/kb"] });
    setDraft((d) => ({ ...d, id: body.article.id }));
    setState({
      saving: false,
      msg: `Saved ${body.article.number}${body.notified ? `. ${body.notified} subscriber${body.notified === 1 ? "" : "s"} emailed.` : "."}`,
    });
  };

  const articles = (list.data?.articles ?? []).filter((a) => !filter || `${a.number} ${a.title} ${a.category}`.toLowerCase().includes(filter.toLowerCase()));
  const current = list.data?.articles.find((a) => a.id === draft.id);

  return (
    <PortalLayout title="Knowledge base authoring" description="Write, preview and publish knowledge articles." width="full">
      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="kb-admin-list" className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="kb-admin-list" className="font-semibold">
              Articles
            </h2>
            <button type="button" onClick={() => setDraft(BLANK)} className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))]">
              <Plus className="h-4 w-4" aria-hidden="true" /> New
            </button>
          </div>
          <div className="p-3">
            <label htmlFor="kb-admin-filter" className="sr-only">
              Filter articles
            </label>
            <input id="kb-admin-filter" className={field} placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {list.isLoading ? (
            <Skeleton className="m-3 h-40" />
          ) : list.isError ? (
            <p className="p-3 text-sm text-destructive">Articles couldn't be loaded (DE admin only).</p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {articles.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => open(a)}
                    aria-current={draft.id === a.id ? "true" : undefined}
                    className={cn("block w-full px-4 py-2.5 text-left hover:bg-accent", draft.id === a.id && "bg-accent")}
                  >
                    <span className="block text-xs text-muted-foreground">
                      {a.number} · {a.category}
                    </span>
                    <span className="block text-sm font-medium">{a.title}</span>
                    <span className="mt-1 flex gap-1">
                      <Token label={a.status === "published" ? "Published" : "Draft"} tone={a.status === "published" ? "ok" : "warn"} />
                      {a.audience === "company" && <Token label="One company" tone="info" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="kb-admin-edit" className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 id="kb-admin-edit" className="font-semibold">
            {current ? `Edit ${current.number}` : "New article"}
          </h2>
          <div>
            <label htmlFor="kb-title-in" className="mb-1 block text-sm font-medium">
              Title
            </label>
            <input id="kb-title-in" className={field} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label htmlFor="kb-summary-in" className="mb-1 block text-sm font-medium">
              Summary (shown in lists and search)
            </label>
            <input id="kb-summary-in" className={field} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="kb-cat-in" className="mb-1 block text-sm font-medium">
                Category
              </label>
              <input id="kb-cat-in" list="kb-cats" className={field} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="kb-cats">
                {KB_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="kb-tags-in" className="mb-1 block text-sm font-medium">
                Tags (comma separated)
              </label>
              <input id="kb-tags-in" className={field} value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} />
            </div>
            <div>
              <label htmlFor="kb-aud-in" className="mb-1 block text-sm font-medium">
                Who can see it
              </label>
              <select id="kb-aud-in" className={field} value={draft.audienceClientId} onChange={(e) => setDraft({ ...draft, audienceClientId: e.target.value })}>
                <option value="">All clients</option>
                {companyList.map((c) => (
                  <option key={c.id} value={c.id}>
                    Only {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="kb-status-in" className="mb-1 block text-sm font-medium">
                Status
              </label>
              <select id="kb-status-in" className={field} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}>
                <option value="draft">Draft (only DE admins see it)</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="kb-body-in" className="mb-1 block text-sm font-medium">
              Body
            </label>
            <textarea
              id="kb-body-in"
              className={cn(field, "min-h-[420px] font-mono text-[13px] leading-relaxed")}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              spellCheck
            />
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Formatting</summary>
              <ul className="mt-1 space-y-0.5">
                {CHEATSHEET.map(([k, v]) => (
                  <li key={k}>
                    <code className="rounded bg-muted px-1">{k}</code> {v}
                  </li>
                ))}
              </ul>
            </details>
          </div>
          {draft.id && draft.status === "published" && current?.status === "published" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.notifySubscribers} onChange={(e) => setDraft({ ...draft, notifySubscribers: e.target.checked })} />
              Email subscribers about this revision
            </label>
          )}
          {state.error && <Callout tone="bad" title={state.error} />}
          {state.msg && (
            <Callout tone="ok" title={state.msg}>
              {current && current.status === "published" && (
                <Link href={`/portal/kb/${current.number}`} className="underline">
                  Open the article
                </Link>
              )}
            </Callout>
          )}
          <button type="button" onClick={() => void save()} disabled={state.saving} className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {state.saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {draft.id ? "Save changes" : "Create article"}
          </button>
        </section>

        <section aria-labelledby="kb-admin-preview" className="rounded-xl border border-border bg-card p-4">
          <h2 id="kb-admin-preview" className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </h2>
          <h3 className="text-2xl font-semibold">{draft.title || "Untitled"}</h3>
          {draft.summary && <p className="mt-1 text-sm text-muted-foreground">{draft.summary}</p>}
          <hr className="my-4 border-border" />
          <KbBody body={draft.body} />
        </section>
      </div>
    </PortalLayout>
  );
}
