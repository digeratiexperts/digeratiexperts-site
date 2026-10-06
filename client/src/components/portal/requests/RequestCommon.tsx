import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { srApi, type PersonOption } from "@/lib/serviceRequestsApi";
import { AddressBlock, CheckboxField, LookupField } from "./fields";
import type { FormValues } from "./useServiceRequestForm";
import { STATUS_LABELS, type ServiceRequestRecord, type ServiceRequestSite } from "@shared/serviceRequests";

/** Context (company, me, sites) and the basket count, shared by both forms. */
export function useRequestContext() {
  const context = useQuery({ queryKey: ["/api/portal/service-requests/context"], queryFn: srApi.context, staleTime: 60_000 });
  const basket = useQuery({ queryKey: ["/api/portal/service-requests/basket"], queryFn: srApi.basket });
  return { context, basketCount: basket.data?.requests.length ?? 0 };
}

export function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["/api/portal/service-requests/basket"] });
    void qc.invalidateQueries({ queryKey: ["/api/portal/service-requests"] });
  };
}

/** Requested for: same-company people, defaulting to the signed-in user. */
export function RequestedForField({
  value,
  onChange,
  me,
  error,
  highlighted,
}: {
  value: PersonOption | null;
  onChange: (p: PersonOption | null) => void;
  me: PersonOption | null;
  error?: string;
  highlighted?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 200);
    return () => window.clearTimeout(t);
  }, [q]);
  const people = useQuery({
    queryKey: ["/api/portal/service-requests/people", debounced],
    queryFn: () => srApi.people(debounced),
  });
  const options = people.data?.people ?? (me ? [me] : []);
  return (
    <LookupField<PersonOption>
      id="sr-requested-for"
      label="Requested for"
      required
      value={value}
      onChange={onChange}
      options={options}
      onSearch={setQ}
      getKey={(p) => p.userId}
      getLabel={(p) => p.name}
      getDetail={(p) => p.email}
      renderInfo={(p) => (
        <div className="space-y-1">
          <p className="font-semibold">{p.name}</p>
          <p className="text-muted-foreground">{p.email}</p>
          {me?.userId === p.userId && <p className="text-xs text-muted-foreground">That's you</p>}
        </div>
      )}
      emptyText={people.isLoading ? "Searching…" : "No one in your company matches"}
      error={error}
      highlighted={highlighted}
    />
  );
}

/**
 * Site Location Code (LID), the "not a [company] location" checkbox and the
 * address. Picking a site fills the address read-only; ticking the box makes
 * the LID optional and the address editable and required.
 */
export function LocationSection({
  values,
  setField,
  sites,
  companyName,
  errors,
  isHighlighted,
}: {
  values: FormValues;
  setField: (path: string, v: unknown) => void;
  sites: ServiceRequestSite[];
  companyName: string;
  errors: Record<string, string | undefined>;
  isHighlighted: (k: string) => boolean;
}) {
  const site = useMemo(() => sites.find((s) => s.id === values.siteId) ?? null, [sites, values.siteId]);
  const custom = Boolean(values.addressNotClientLocation);
  const shown = custom ? values.customAddress : site ?? { street: "", city: "", state: "", country: "United States of America", zip: "" };
  return (
    <div className="space-y-4">
      <LookupField<ServiceRequestSite>
        id="sr-site"
        label="Site Location Code (LID)"
        required={!custom}
        value={site}
        onChange={(s) => setField("siteId", s?.id ?? "")}
        options={sites}
        getKey={(s) => s.id}
        getLabel={(s) => s.code}
        getDetail={(s) => [s.name, `${s.city}, ${s.state}`].filter(Boolean).join(" · ")}
        renderInfo={(s) => (
          <div className="space-y-1">
            <p className="font-semibold">
              {s.code}
              {s.name ? ` · ${s.name}` : ""}
            </p>
            <p className="text-muted-foreground">
              {s.street}, {s.city}, {s.state} {s.zip}
            </p>
          </div>
        )}
        emptyText="No sites on file. Tick the box below to enter an address."
        error={errors.siteId}
        highlighted={isHighlighted("siteId")}
      />
      <CheckboxField
        id="sr-not-company-location"
        label={`Address is not a ${companyName || "company"} location`}
        checked={custom}
        onChange={(v) => setField("addressNotClientLocation", v)}
      />
      <AddressBlock
        idPrefix="sr-addr"
        value={shown}
        onChange={(p) => {
          for (const [k, v] of Object.entries(p)) setField(`customAddress.${k}`, v);
        }}
        editable={custom}
        errors={errors}
        highlighted={isHighlighted}
      />
    </div>
  );
}

/** After Order Now: the request number and a link to its detail page. */
export function SubmittedConfirmation({
  request,
  attachmentFailures,
  onAnother,
}: {
  request: ServiceRequestRecord;
  attachmentFailures: string[];
  onAnother: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
      <CheckCircle2 className="mx-auto h-12 w-12 text-[rgb(var(--pt-ok))]" aria-hidden="true" />
      <h1 ref={heading} tabIndex={-1} className="mt-4 text-2xl font-semibold text-foreground focus:outline-none">
        Request submitted
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your request number is{" "}
        <span className="pt-num font-semibold text-foreground" data-testid="sr-confirmation-number">
          {request.number}
        </span>
        . Status: {STATUS_LABELS[request.status]}.
      </p>
      {attachmentFailures.length > 0 && (
        <p className="mt-3 text-sm text-destructive">
          {attachmentFailures.length === 1 ? "One attachment" : `${attachmentFailures.length} attachments`} did not upload (
          {attachmentFailures.join(", ")}). You can add {attachmentFailures.length === 1 ? "it" : "them"} from the request page.
        </p>
      )}
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href={`/portal/requests/${request.id}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          View request {request.number}
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-5 text-sm font-semibold text-foreground hover:bg-accent"
        >
          Make another request
        </button>
      </div>
    </div>
  );
}
