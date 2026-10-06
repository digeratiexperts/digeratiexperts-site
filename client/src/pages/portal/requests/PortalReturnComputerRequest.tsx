import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "../PortalLayout";
import { Callout } from "@/components/portal/ui";
import { ServiceRequestShell } from "@/components/portal/requests/ServiceRequestShell";
import { ReturnComputerIcon } from "@/components/portal/requests/icons";
import {
  CheckboxField,
  DateField,
  LookupField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/portal/requests/fields";
import { useServiceRequestForm, type SubmitResult } from "@/components/portal/requests/useServiceRequestForm";
import {
  LocationSection,
  RequestedForField,
  SubmittedConfirmation,
  useInvalidateRequests,
  useRequestContext,
} from "@/components/portal/requests/RequestCommon";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import { srApi, type PersonOption } from "@/lib/serviceRequestsApi";
import { RETURN_REASONS, type ServiceRequestAsset } from "@shared/serviceRequests";

const TYPE = "return_computer" as const;

export default function PortalReturnComputerRequest() {
  const form = useServiceRequestForm(TYPE);
  const [, navigate] = useLocation();
  const { context, basketCount } = useRequestContext();
  const invalidate = useInvalidateRequests();
  const [person, setPerson] = useState<PersonOption | null>(null);
  // Amend: show the person the request is for.
  useEffect(() => {
    if (form.amending) setPerson({ ...form.amending.requestedFor });
  }, [form.amending]);
  const [done, setDone] = useState<Extract<SubmitResult, { kind: "submitted" }> | null>(null);
  const [basketNote, setBasketNote] = useState<string | null>(null);
  const { values, setField, errors } = form;
  const ctx = context.data;
  const company = ctx?.company.name ?? "";

  useEffect(() => {
    if (!ctx) return;
    if (ctx.me && !values.requestedForUserId && !person) {
      setPerson(ctx.me);
      setField("requestedForUserId", ctx.me.userId);
    }
    if (ctx.defaultSiteId && !values.siteId) setField("siteId", ctx.defaultSiteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  // Assets assigned to whoever the request is for; a change of person clears the pick.
  const assets = useQuery({
    queryKey: ["/api/portal/service-requests/assets", values.requestedForUserId],
    queryFn: () => srApi.assets(values.requestedForUserId),
    enabled: Boolean(values.requestedForUserId),
  });
  const assetList = assets.data?.assets ?? [];
  const selectedAsset = assetList.find((a) => a.id === values.assetId) ?? null;

  const keepDefaults = () => ({ requestedForUserId: ctx?.me?.userId ?? "", siteId: ctx?.defaultSiteId ?? "" });

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
      form.reset(keepDefaults());
    }
  };

  if (done) {
    return (
      <PortalLayout title="Return Computer" hideHeader width="default">
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

  const sectionHeading = "pt-2 text-base font-semibold text-foreground";

  return (
    <PortalLayout title="Return Computer" hideHeader width="wide">
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
        amending={form.amending?.number}
        amendError={form.amendError}
        type={TYPE}
        title="Return Computer"
        subtitle="Request return of computer"
        description="Request selected computer to be returned from current owner to IT stockroom or to be disposed."
        icon={<ReturnComputerIcon className="h-auto w-full" />}
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
            form.patch({ requestedForUserId: p?.userId ?? "", assetId: "" });
          }}
          error={errors.requestedForUserId}
        />

        <TextField
          id="sr-contact-phone"
          label="Contact Phone Number"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={values.contactPhone}
          onChange={(v) => setField("contactPhone", v)}
          error={errors.contactPhone}
          highlighted={form.isHighlighted("contactPhone")}
        />

        <SelectField
          id="sr-return-reason"
          label="Reason for PC return"
          required
          value={values.returnReason}
          onChange={(v) => setField("returnReason", v)}
          options={RETURN_REASONS.map((r) => ({ value: r.key, label: r.label(company) }))}
          error={errors.returnReason}
          highlighted={form.isHighlighted("returnReason")}
        />

        <section aria-labelledby="sr-select-computer" className="space-y-4">
          <h2 id="sr-select-computer" className={sectionHeading}>
            Select Computer
          </h2>
          <LookupField<ServiceRequestAsset>
            id="sr-asset"
            label="Select from your assigned assets"
            required={!values.assetNotListed}
            value={selectedAsset}
            onChange={(a) => setField("assetId", a?.id ?? "")}
            options={assetList}
            getKey={(a) => a.id}
            getLabel={(a) => [a.assetTag, a.model].filter(Boolean).join(" · ")}
            getDetail={(a) => (a.serialNumber ? `S/N ${a.serialNumber}` : undefined)}
            renderInfo={(a) => (
              <div className="space-y-1">
                <p className="font-semibold">{a.assetTag}</p>
                {a.model && <p>{a.model}</p>}
                {a.serialNumber && <p className="text-muted-foreground">S/N {a.serialNumber}</p>}
              </div>
            )}
            emptyText={
              assets.isLoading
                ? "Loading…"
                : "No computers are on file for this person. Tick “I don't see the computer in my assigned assets”."
            }
            disabled={values.assetNotListed}
            error={errors.assetId}
          />
          <CheckboxField
            id="sr-asset-not-listed"
            label="I don't see the computer in my assigned assets"
            checked={values.assetNotListed}
            onChange={(v) => form.patch({ assetNotListed: v, ...(v ? { assetId: "" } : {}) })}
            highlighted={form.isHighlighted("assetNotListed")}
          />
          {values.assetNotListed && (
            <div className="grid gap-4 rounded-lg border border-dashed border-border p-4 md:grid-cols-2">
              <p className="text-sm text-muted-foreground md:col-span-2">
                Tell us which computer it is. Any one of these is enough; more helps.
              </p>
              <TextField
                id="sr-manual-asset-tag"
                label="Asset tag"
                value={values.manualAsset.assetTag}
                onChange={(v) => setField("manualAsset.assetTag", v)}
                error={errors["manualAsset.assetTag"]}
                highlighted={form.isHighlighted("manualAsset.assetTag")}
              />
              <TextField
                id="sr-manual-asset-serial"
                label="Serial number"
                value={values.manualAsset.serialNumber}
                onChange={(v) => setField("manualAsset.serialNumber", v)}
                highlighted={form.isHighlighted("manualAsset.serialNumber")}
              />
              <TextAreaField
                id="sr-manual-asset-description"
                label="Description (make, model, where it is)"
                className="md:col-span-2"
                rows={2}
                value={values.manualAsset.description}
                onChange={(v) => setField("manualAsset.description", v)}
                highlighted={form.isHighlighted("manualAsset.description")}
              />
            </div>
          )}
          <TextAreaField
            id="sr-accessories"
            label="Accessories to be returned with the PC"
            required
            value={values.accessories}
            onChange={(v) => setField("accessories", v)}
            maxLength={2000}
            error={errors.accessories}
            highlighted={form.isHighlighted("accessories")}
          />
        </section>

        <section aria-labelledby="sr-current-location" className="space-y-4">
          <h2 id="sr-current-location" className={sectionHeading}>
            Current location of the computer
          </h2>
          <LocationSection
            values={values}
            setField={setField}
            sites={ctx?.sites ?? []}
            companyName={company}
            errors={errors}
            isHighlighted={form.isHighlighted}
          />
        </section>

        <DateField
          id="sr-preferred-return"
          label="Select preferred date for return of the PC"
          value={values.preferredReturnDate}
          onChange={(v) => setField("preferredReturnDate", v)}
          minDate={form.today}
          error={errors.preferredReturnDate}
          highlighted={form.isHighlighted("preferredReturnDate")}
        />
        <TextAreaField
          id="sr-comments"
          label="Additional Comments"
          value={values.additionalComments}
          onChange={(v) => setField("additionalComments", v)}
          maxLength={4000}
          highlighted={form.isHighlighted("additionalComments")}
        />
      </ServiceRequestShell>

      <PortalHelpChat
        page={{ kind: "service_request_form", requestType: TYPE, title: "Return Computer" }}
        form={{ values, chips: form.chips, fill: form.fillFromAssistant, companyName: company }}
      />
    </PortalLayout>
  );
}
