import { useEffect, useState } from "react";
import { Link } from "wouter";
import { PortalLayout } from "../PortalLayout";
import { Callout } from "@/components/portal/ui";
import { ServiceRequestShell } from "@/components/portal/requests/ServiceRequestShell";
import { LoanerComputerIcon } from "@/components/portal/requests/icons";
import { DateField, Highlight, FieldError, TextAreaField, TextField } from "@/components/portal/requests/fields";
import { useServiceRequestForm, type SubmitResult } from "@/components/portal/requests/useServiceRequestForm";
import {
  LocationSection,
  RequestedForField,
  SubmittedConfirmation,
  useInvalidateRequests,
  useRequestContext,
} from "@/components/portal/requests/RequestCommon";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import type { PersonOption } from "@/lib/serviceRequestsApi";

const TYPE = "loaner_computer" as const;

export default function PortalLoanerComputerRequest() {
  const form = useServiceRequestForm(TYPE);
  const { context, basketCount } = useRequestContext();
  const invalidate = useInvalidateRequests();
  const [person, setPerson] = useState<PersonOption | null>(null);
  const [done, setDone] = useState<Extract<SubmitResult, { kind: "submitted" }> | null>(null);
  const [basketNote, setBasketNote] = useState<string | null>(null);
  const { values, setField, errors } = form;
  const ctx = context.data;

  // Defaults: the signed-in user as Requested for, the only site as LID.
  useEffect(() => {
    if (!ctx) return;
    if (ctx.me && !values.requestedForUserId && !person) {
      setPerson(ctx.me);
      setField("requestedForUserId", ctx.me.userId);
    }
    if (ctx.defaultSiteId && !values.siteId) setField("siteId", ctx.defaultSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  const keepDefaults = () => ({
    requestedForUserId: ctx?.me?.userId ?? "",
    siteId: ctx?.defaultSiteId ?? "",
  });

  const run = async (mode: "submit" | "basket") => {
    setBasketNote(null);
    const result = await form.submit(mode);
    if (!result) return;
    invalidate();
    if (result.kind === "submitted") {
      setDone(result);
      window.scrollTo({ top: 0 });
    } else {
      setBasketNote(`${result.request.number} is in your request basket.`);
      setPerson(ctx?.me ?? null);
      form.reset(keepDefaults());
    }
  };

  if (done) {
    return (
      <PortalLayout title="Request Loaner Computer" hideHeader width="default">
        <SubmittedConfirmation
          request={done.request}
          attachmentFailures={done.attachmentFailures}
          onAnother={() => {
            setDone(null);
            setPerson(ctx?.me ?? null);
            form.reset(keepDefaults());
          }}
        />
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Request Loaner Computer" hideHeader width="wide">
      {context.isError && (
        <Callout tone="bad" title="This form couldn't load your company details" className="mb-4">
          {context.error instanceof Error ? context.error.message : "Unknown error"}
        </Callout>
      )}
      {basketNote && (
        <Callout tone="ok" title="Added to your request basket" className="mb-4">
          {basketNote}{" "}
          <Link href="/portal/requests/basket" className="font-semibold underline">
            Review and submit the basket
          </Link>
        </Callout>
      )}
      <ServiceRequestShell
        type={TYPE}
        title="Request Loaner Computer"
        subtitle="Request Loaner Computer"
        description="Request Loaner Computer for a limited time use. Computer will be provided if there is suitable device available for the specified time period."
        icon={<LoanerComputerIcon className="h-auto w-full" />}
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

        <TextField
          id="sr-contact-phone"
          label="Contact phone number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.contactPhone}
          onChange={(v) => setField("contactPhone", v)}
          error={errors.contactPhone}
          highlighted={form.isHighlighted("contactPhone")}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Highlight on={form.isHighlighted("deviceKind")}>
            <fieldset aria-describedby={errors.deviceKind ? "sr-device-error" : undefined}>
              <legend className="mb-1.5 text-sm font-medium text-foreground">
                <span className="mr-0.5 text-destructive" aria-hidden="true">
                  *
                </span>
                Do you need laptop or desktop?
                <span className="sr-only"> (required)</span>
              </legend>
              <div className="space-y-1">
                {(["laptop", "desktop"] as const).map((k) => (
                  <label key={k} htmlFor={`sr-device-${k}`} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm text-foreground sm:min-h-[32px]">
                    <input
                      id={`sr-device-${k}`}
                      type="radio"
                      name="deviceKind"
                      value={k}
                      checked={values.deviceKind === k}
                      onChange={() => setField("deviceKind", k)}
                      className="h-4 w-4 accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {k === "laptop" ? "Laptop" : "Desktop"}
                  </label>
                ))}
              </div>
              <FieldError id="sr-device-error" error={errors.deviceKind} />
            </fieldset>
          </Highlight>
          <div className="space-y-4">
            <DateField
              id="sr-needed-from"
              label="Needed from date"
              required
              value={values.neededFrom}
              onChange={(v) => setField("neededFrom", v)}
              minDate={form.today}
              error={errors.neededFrom}
              highlighted={form.isHighlighted("neededFrom")}
            />
            <DateField
              id="sr-loan-until"
              label="Loan until"
              required
              value={values.loanUntil}
              onChange={(v) => setField("loanUntil", v)}
              minDate={values.neededFrom || form.today}
              error={errors.loanUntil}
              highlighted={form.isHighlighted("loanUntil")}
            />
          </div>
        </div>

        <LocationSection
          values={values}
          setField={setField}
          sites={ctx?.sites ?? []}
          companyName={ctx?.company.name ?? ""}
          errors={errors}
          isHighlighted={form.isHighlighted}
        />

        <TextAreaField
          id="sr-accessories"
          label="Do you require additional accessories and peripherals?"
          value={values.accessories}
          onChange={(v) => setField("accessories", v)}
          maxLength={2000}
          error={errors.accessories}
          highlighted={form.isHighlighted("accessories")}
        />
        <TextAreaField
          id="sr-reason"
          label="Reason for a loaner computer"
          required
          value={values.reason}
          onChange={(v) => setField("reason", v)}
          maxLength={4000}
          error={errors.reason}
          highlighted={form.isHighlighted("reason")}
        />
        <TextAreaField
          id="sr-notes"
          label="Additional Notes"
          value={values.additionalNotes}
          onChange={(v) => setField("additionalNotes", v)}
          maxLength={4000}
          error={errors.additionalNotes}
          highlighted={form.isHighlighted("additionalNotes")}
        />
      </ServiceRequestShell>

      <PortalHelpChat
        page={{ kind: "service_request_form", requestType: TYPE, title: "Request Loaner Computer" }}
        form={{ values, chips: form.chips, fill: form.fillFromAssistant, companyName: ctx?.company.name ?? "" }}
      />
    </PortalLayout>
  );
}
