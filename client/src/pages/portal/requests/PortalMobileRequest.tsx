import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Smartphone } from "lucide-react";
import { PortalLayout } from "../PortalLayout";
import { Callout } from "@/components/portal/ui";
import { ServiceRequestShell } from "@/components/portal/requests/ServiceRequestShell";
import { DateField, FieldError, FieldLabel, TextAreaField, TextField, controlClass } from "@/components/portal/requests/fields";
import { useServiceRequestForm, type SubmitResult } from "@/components/portal/requests/useServiceRequestForm";
import { RequestedForField, SubmittedConfirmation, useInvalidateRequests, useRequestContext } from "@/components/portal/requests/RequestCommon";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import type { PersonOption } from "@/lib/serviceRequestsApi";
import { MOBILE_ACTIVITY_GROUPS, mobileActivityLabel } from "@shared/serviceRequests";

const TYPE = "mobile_request" as const;

export default function PortalMobileRequest() {
  const form = useServiceRequestForm(TYPE);
  const [, navigate] = useLocation();
  const { context, basketCount } = useRequestContext();
  const invalidate = useInvalidateRequests();
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [done, setDone] = useState<Extract<SubmitResult, { kind: "submitted" }> | null>(null);
  const [basketNote, setBasketNote] = useState<string | null>(null);
  const [activityQuery, setActivityQuery] = useState("");
  const { values, setField, errors } = form;
  const visibleActivityGroups = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    if (!q) return MOBILE_ACTIVITY_GROUPS;
    return MOBILE_ACTIVITY_GROUPS.map((group) => ({
      ...group,
      activities: group.activities.filter(([, label]) => label.toLowerCase().includes(q)),
    })).filter((group) => group.activities.length > 0);
  }, [activityQuery]);
  const ctx = context.data;

  useEffect(() => {
    if (form.amending) setPerson({ ...form.amending.requestedFor });
  }, [form.amending]);

  useEffect(() => {
    if (ctx?.me && !values.requestedForUserId && !person) {
      setPerson(ctx.me);
      setField("requestedForUserId", ctx.me.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  const run = async (mode: "submit" | "basket") => {
    setBasketNote(null);
    const result = await form.submit(mode);
    if (!result) return;
    invalidate();
    if (result.kind === "amended") return navigate(`/portal/requests/${result.request.id}`);
    if (result.kind === "submitted") {
      setDone(result);
      window.scrollTo({ top: 0 });
    } else {
      setBasketNote(`${result.request.number} is in your request basket.`);
      setPerson(ctx?.me ?? null);
      form.reset({ requestedForUserId: ctx?.me?.userId ?? "" });
    }
  };

  if (done) {
    return (
      <PortalLayout title="Mobile & Carrier Service" hideHeader width="default">
        <SubmittedConfirmation
          request={done.request}
          attachmentFailures={done.attachmentFailures}
          onAnother={() => {
            setDone(null);
            setPerson(ctx?.me ?? null);
            form.reset({ requestedForUserId: ctx?.me?.userId ?? "" });
          }}
        />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Mobile & Carrier Service" hideHeader width="wide">
      {basketNote && (
        <Callout tone="ok" title="Added to your request basket" className="mb-4">
          {basketNote}{" "}
          <Link href="/portal/requests/basket" className="font-semibold underline">
            Review and submit the basket
          </Link>
        </Callout>
      )}
      <ServiceRequestShell
        amending={form.amending?.number}
        amendError={form.amendError}
        type={TYPE}
        title="Mobile & Carrier Service"
        subtitle={values.activity ? mobileActivityLabel(values.activity) : "Phones, lines, SIMs, carriers, travel and ownership changes"}
        description="Choose the mobile activity you need. DE keeps the request vendor-neutral, routes it through your company approval rules, and carries the selected activity into the service desk and Intelligence Hub."
        icon={<Smartphone className="h-28 w-28" strokeWidth={1.4} />}
        chips={form.chips}
        onChipClick={form.focusField}
        onOrderNow={() => void run("submit")}
        onAddToCart={() => void run("basket")}
        busy={form.busy}
        basketCount={basketCount}
        files={form.files}
        onAddFiles={form.addFiles}
        onRemoveFile={form.removeFile}
        fileError={form.fileError}
        formError={form.formError}
        announcement={form.announcement}
      >
        <RequestedForField
          value={person}
          me={ctx?.me ?? null}
          onChange={(p) => {
            setPerson(p);
            setField("requestedForUserId", p?.userId ?? "");
          }}
          error={errors.requestedForUserId}
        />

        <fieldset aria-describedby={errors.activity ? "sr-mobile-activity-error" : undefined}>
          <FieldLabel id="sr-mobile-activity-label" required>Activity</FieldLabel>
          <input
            id="sr-mobile-activity"
            type="search"
            value={activityQuery}
            onChange={(e) => setActivityQuery(e.target.value)}
            placeholder="Search mobile activities"
            aria-labelledby="sr-mobile-activity-label"
            className={controlClass}
          />
          <div className="mt-3 space-y-4">
            {visibleActivityGroups.map((group) => (
              <section key={group.key} aria-labelledby={`sr-mobile-group-${group.key}`}>
                <h3 id={`sr-mobile-group-${group.key}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.label}
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.activities.map(([key, label]) => {
                    const selected = values.activity === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setField("activity", key)}
                        className={`min-h-[48px] rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.10)] text-foreground"
                            : "border-border bg-card text-foreground hover:bg-accent"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {visibleActivityGroups.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">No mobile activities match that search.</p>
            )}
          </div>
          <FieldError id="sr-mobile-activity-error" error={errors.activity} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="sr-mobile-number"
            label="Mobile number"
            value={values.mobileNumber}
            onChange={(v) => setField("mobileNumber", v)}
            inputMode="tel"
            autoComplete="tel"
            error={errors.mobileNumber}
            highlighted={form.isHighlighted("mobileNumber")}
          />
          <TextField
            id="sr-mobile-carrier"
            label="Carrier"
            value={values.carrier}
            onChange={(v) => setField("carrier", v)}
            error={errors.carrier}
            highlighted={form.isHighlighted("carrier")}
          />
        </div>

        <TextField
          id="sr-mobile-device"
          label="Device / IMEI / EID / asset tag"
          value={values.deviceIdentifier}
          onChange={(v) => setField("deviceIdentifier", v)}
          error={errors.deviceIdentifier}
          highlighted={form.isHighlighted("deviceIdentifier")}
        />

        <DateField
          id="sr-mobile-effective"
          label="Requested effective date"
          value={values.effectiveDate}
          onChange={(v) => setField("effectiveDate", v)}
          minDate={form.today}
          error={errors.effectiveDate}
          highlighted={form.isHighlighted("effectiveDate")}
        />

        <TextAreaField
          id="sr-mobile-details"
          label="What do you need?"
          required
          value={values.details}
          onChange={(v) => setField("details", v)}
          rows={4}
          maxLength={4000}
          error={errors.details}
          highlighted={form.isHighlighted("details")}
        />
      </ServiceRequestShell>
      <PortalHelpChat
        page={{ kind: "service_request_form", requestType: TYPE, title: "Mobile & Carrier Service" }}
        form={{ values, chips: form.chips, fill: form.fillFromAssistant, companyName: ctx?.company.name ?? "" }}
      />
    </PortalLayout>
  );
}
