import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "../PortalLayout";
import { Callout } from "@/components/portal/ui";
import { ServiceRequestShell } from "@/components/portal/requests/ServiceRequestShell";
import { LicenseIcon } from "@/components/portal/requests/icons";
import { FieldError, Highlight, SelectField, TextAreaField, TextField } from "@/components/portal/requests/fields";
import { useServiceRequestForm, type SubmitResult } from "@/components/portal/requests/useServiceRequestForm";
import { RequestedForField, SubmittedConfirmation, useInvalidateRequests, useRequestContext } from "@/components/portal/requests/RequestCommon";
import { AssignmentToken } from "@/components/portal/licensing/LicensePolicyTables";
import { PortalHelpChat } from "@/components/portal/assist/PortalHelpChat";
import { licensingApi } from "@/lib/licensingApi";
import type { PersonOption } from "@/lib/serviceRequestsApi";
import { accountTypeLabel, platformLabel } from "@shared/licensing";

const TYPE = "license_request" as const;

const ACCOUNT_KINDS = [
  { key: "person", label: "A person in my company" },
  { key: "admin", label: "An admin account" },
  { key: "service", label: "A service account" },
  { key: "shared", label: "A shared or generic account" },
] as const;

const APPROVAL_TEXT = {
  none: "No approval needed; DE adds the account to the group.",
  manager: "Your manager approves first, then DE adds the account to the group.",
  it_contact: "Your company IT contact approves first, then DE adds the account to the group.",
} as const;

/**
 * Request a Software License: you never ask for a licence directly. DE adds
 * the account to the group your company's policy names, and the licence is
 * applied. Accounts the policy licenses automatically are told so instead.
 */
export default function PortalLicenseRequest() {
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

  useEffect(() => {
    if (ctx?.me && !values.requestedForUserId && !person) {
      setPerson(ctx.me);
      setField("requestedForUserId", ctx.me.userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  const ent = useQuery({
    queryKey: ["/api/portal/licensing/entitlements", values.accountKind, values.requestedForUserId],
    queryFn: () =>
      licensingApi.entitlements(values.accountKind === "person" ? { accountKind: "person", userId: values.requestedForUserId } : { accountKind: values.accountKind }),
    enabled: values.accountKind !== "person" || Boolean(values.requestedForUserId),
  });
  const platforms = ent.data?.platforms ?? [];
  const licenses = ent.data?.licenses ?? [];

  // One platform: pick it. A platform or account change clears a licence that no longer fits.
  useEffect(() => {
    if (platforms.length === 1 && values.platform !== platforms[0].platform) setField("platform", platforms[0].platform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platforms.length]);
  const onPlatform = licenses.filter((l) => l.platform === values.platform);
  useEffect(() => {
    // Only once the entitlements have loaded, so an amended request keeps its licence while they load.
    if (ent.data && values.licenseKey && !onPlatform.some((l) => l.licenseKey === values.licenseKey)) setField("licenseKey", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.platform, values.accountKind, values.requestedForUserId, licenses.length]);

  const chosen = useMemo(() => onPlatform.find((l) => l.licenseKey === values.licenseKey) ?? null, [onPlatform, values.licenseKey]);
  const automaticBase = onPlatform.find((l) => l.kind === "base" && l.assignment === "automatic");
  const accountLabel = values.accountKind === "person" ? person?.name ?? "this person" : values.accountName || "the account";

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
      <PortalLayout title="Request a Software License" hideHeader width="default">
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
    <PortalLayout title="Request a Software License" hideHeader width="wide">
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
        title="Request a Software License"
        subtitle="Microsoft 365, Google Workspace, Zoho and add-on licences"
        description="You don't request a licence directly. DE adds the account to the licence group your company's policy names, and the licence is applied automatically."
        icon={<LicenseIcon className="h-auto w-full" />}
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
            form.patch({ requestedForUserId: p?.userId ?? "", licenseKey: "" });
          }}
          error={errors.requestedForUserId}
        />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">
            <span className="mr-0.5 text-destructive" aria-hidden="true">
              *
            </span>
            Who is the licence for?
          </legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {ACCOUNT_KINDS.map((k) => (
              <label key={k.key} htmlFor={`sr-kind-${k.key}`} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm">
                <input
                  id={`sr-kind-${k.key}`}
                  type="radio"
                  name="accountKind"
                  checked={values.accountKind === k.key}
                  onChange={() => form.patch({ accountKind: k.key, licenseKey: "" })}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                {k.label}
              </label>
            ))}
          </div>
          {values.accountKind !== "person" && (
            <p className="mt-1 text-xs text-muted-foreground">The person in Requested for owns this account.</p>
          )}
        </fieldset>

        {values.accountKind !== "person" && (
          <TextField
            id="sr-account-name"
            label="Account name"
            required
            value={values.accountName}
            onChange={(v) => setField("accountName", v)}
            error={errors.accountName}
            highlighted={form.isHighlighted("accountName")}
          />
        )}

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-foreground">Operation</legend>
          <div className="flex flex-wrap gap-x-6">
            {[
              ["add", "Add to licence group"],
              ["remove", "Remove from licence group"],
            ].map(([k, label]) => (
              <label key={k} htmlFor={`sr-op-${k}`} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm">
                <input id={`sr-op-${k}`} type="radio" name="operation" checked={values.operation === k} onChange={() => setField("operation", k)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {ent.isError ? (
          <Callout tone="bad" title="Licences couldn't be loaded">
            {ent.error instanceof Error ? ent.error.message : ""}
          </Callout>
        ) : !ent.isLoading && platforms.length === 0 ? (
          <Callout tone="warn" title="No licence policy on file yet">
            DE hasn't recorded your company's licence policy. You can still{" "}
            <Link href="/portal/tickets/create" className="underline">
              open a ticket
            </Link>{" "}
            and we'll help.
          </Callout>
        ) : (
          <>
            {ent.data && (
              <p className="text-sm text-muted-foreground">
                Account type: <span className="font-medium text-foreground">{accountTypeLabel(ent.data.classification.accountType)}</span>
                {ent.data.classification.tier ? ` · ${ent.data.classification.tier}` : ""}.{" "}
                <Link href="/portal/licensing" className="text-[hsl(var(--primary))] underline">
                  See your company's licence policy
                </Link>
              </p>
            )}
            <SelectField
              id="sr-platform"
              label="Platform"
              required
              value={values.platform}
              onChange={(v) => form.patch({ platform: v, licenseKey: "" })}
              placeholder="Choose a platform"
              options={platforms.map((p) => ({ value: p.platform, label: `${platformLabel(p.platform)}${p.tenantLabel ? ` (${p.tenantLabel})` : ""}` }))}
              error={errors.platform}
            />
            {automaticBase && values.operation === "add" && (
              <Callout tone="ok" title={`${accountLabel} is licensed for ${automaticBase.name} automatically`}>
                No request is needed for the base licence. Request an add-on below if you need one.
              </Callout>
            )}
            <Highlight>
              <fieldset aria-describedby={errors.licenseKey ? "sr-license-error" : undefined}>
                <legend id="sr-license" tabIndex={-1} className="mb-1.5 text-sm font-medium text-foreground">
                  <span className="mr-0.5 text-destructive" aria-hidden="true">
                    *
                  </span>
                  Licence
                </legend>
                {!values.platform ? (
                  <p className="text-sm text-muted-foreground">Choose a platform first.</p>
                ) : onPlatform.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No licences on this platform for this account type.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {onPlatform.map((l) => {
                      const selectable = values.operation === "remove" || l.assignment === "request";
                      return (
                        <li key={`${l.platform}-${l.licenseKey}`}>
                          <label className={`flex min-h-[48px] items-center gap-3 px-3 py-2 text-sm ${selectable ? "cursor-pointer hover:bg-accent" : "opacity-70"}`}>
                            <input
                              type="radio"
                              name="licenseKey"
                              value={l.licenseKey}
                              disabled={!selectable}
                              checked={values.licenseKey === l.licenseKey}
                              onChange={() => setField("licenseKey", l.licenseKey)}
                              className="h-4 w-4 accent-[hsl(var(--primary))]"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{l.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{l.kind === "base" ? "Base" : "Add-on"}</span>
                            </span>
                            <AssignmentToken assignment={l.assignment} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <FieldError id="sr-license-error" error={errors.licenseKey} />
              </fieldset>
            </Highlight>
            {chosen && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p>
                  DE will {values.operation === "remove" ? "remove" : "add"} <span className="font-medium">{accountLabel}</span> {values.operation === "remove" ? "from" : "to"}{" "}
                  {chosen.group ? <code className="break-all text-xs">{chosen.group}</code> : "the licence group"}.
                </p>
                {values.operation === "add" && <p className="mt-1 text-muted-foreground">{APPROVAL_TEXT[chosen.approval]}</p>}
              </div>
            )}
          </>
        )}

        <TextAreaField
          id="sr-justification"
          label="Business justification"
          required
          value={values.businessJustification}
          onChange={(v) => setField("businessJustification", v)}
          maxLength={2000}
          error={errors.businessJustification}
          highlighted={form.isHighlighted("businessJustification")}
        />
      </ServiceRequestShell>
      <PortalHelpChat
        page={{ kind: "service_request_form", requestType: TYPE, title: "Request a Software License" }}
        form={{ values, chips: form.chips, fill: form.fillFromAssistant, companyName: ctx?.company.name ?? "" }}
      />
    </PortalLayout>
  );
}
