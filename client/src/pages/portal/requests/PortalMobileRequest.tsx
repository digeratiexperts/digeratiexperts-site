import { useEffect, useState } from "react";
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
  const { values, setField, errors } = form;
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

        <div>
          <FieldLabel htmlFor="sr-mobile-activity" required>Activity</FieldLabel>
          <select
            id="sr-mobile-activity"
            value={values.activity}
            onChange={(e) => setField("activity", e.target.value)}
            aria-required="true"
            aria-invalid={errors.activity ? true : undefined}
            aria-describedby={errors.activity ? "sr-mobile-activity-error" : undefined}
            className={controlClass}
          >
            <option value="">Choose an activity</option>
            {MOBILE_ACTIVITY_GROUPS.map((group) => (
              <optgroup key={group.key} label={group.label}>
                {group.activities.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <FieldError id="sr-mobile-activity-error" error={errors.activity} />
        </div>

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
