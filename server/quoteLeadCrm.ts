/**
 * Quiz lead -> Zoho CRM (issue 449): the lead, then one scheduled call that
 * says who calls and by when. The call is the record of whether the call
 * happened; the email and the Hub item point at it instead of tracking it
 * themselves, so working the call in Zoho is the one place it gets closed.
 *
 * Owner: when ZOHO_LEAD_ASSIGNMENT_RULE_ID is set the lead is created through
 * that Leads assignment rule and the call goes to whoever the rule picked.
 * Without it Zoho makes the API user (Joe) the owner, and the call follows.
 */
import type { ZohoCRMCall, ZohoCRMLead } from "./zoho/zohoCRM";
import { FOLLOW_UP_LABEL, followUpHeadline, type LeadFollowUp } from "@shared/leadFollowUp";

export interface QuoteLeadCrmDeps {
  createLead(data: Partial<ZohoCRMLead>, options?: { assignmentRuleId?: string }): Promise<any>;
  getRecordOwnerId(module: string, id: string): Promise<string | null>;
  createCall(data: ZohoCRMCall): Promise<{ id?: string } | undefined>;
}

export interface QuoteLeadCrmInput {
  lead: Partial<ZohoCRMLead>;
  name: string;
  company: string;
  phone?: string;
  plan: string;
  description: string;
  followUp: LeadFollowUp;
  assignmentRuleId?: string;
}

export interface QuoteLeadCrmResult {
  zohoLeadId: string | null;
  zohoCallId: string | null;
  ownerId: string | null;
}

/** Zoho web address of a lead, for the email and the Hub. */
export function zohoLeadUrl(leadId: string, orgPath = process.env.ZOHO_CRM_WEB_BASE || "https://crm.zoho.com/crm/org667030734"): string {
  return `${orgPath.replace(/\/$/, "")}/tab/Leads/${encodeURIComponent(leadId)}`;
}

export function scheduledCallFor(input: QuoteLeadCrmInput, leadId: string, ownerId: string | null): ZohoCRMCall {
  return {
    Subject: `Call ${input.name}${input.company ? ` (${input.company})` : ""}: ${input.plan} quiz lead, ${FOLLOW_UP_LABEL[input.followUp.priority].toLowerCase()} priority`,
    Call_Type: "Outbound",
    Outgoing_Call_Status: "Scheduled",
    Call_Start_Time: input.followUp.callBy,
    Call_Purpose: "Prospecting",
    Reminder: "15 minutes before",
    Description: `${followUpHeadline(input.followUp, input.phone)}\n\n${input.description}`,
    What_Id: { id: leadId },
    $se_module: "Leads",
    ...(ownerId ? { Owner: { id: ownerId } } : {}),
  };
}

/**
 * Never throws: a CRM outage must not lose the website lead, which is already
 * on its way to email and the Hub. Each step reports what it managed.
 */
export async function createQuoteLeadWithCall(crm: QuoteLeadCrmDeps, input: QuoteLeadCrmInput): Promise<QuoteLeadCrmResult> {
  const result: QuoteLeadCrmResult = { zohoLeadId: null, zohoCallId: null, ownerId: null };
  try {
    const created = await crm.createLead(
      input.lead,
      input.assignmentRuleId ? { assignmentRuleId: input.assignmentRuleId } : undefined,
    );
    result.zohoLeadId = created?.details?.id || created?.id || null;
  } catch (error: any) {
    console.error("[ZOHO] Failed to create quote lead (non-blocking):", error?.message);
    return result;
  }
  if (!result.zohoLeadId) return result;

  result.ownerId = await crm.getRecordOwnerId("Leads", result.zohoLeadId);
  try {
    const call = await crm.createCall(scheduledCallFor(input, result.zohoLeadId, result.ownerId));
    result.zohoCallId = call?.id || null;
  } catch (error: any) {
    console.error("[ZOHO] Failed to schedule the quote lead call (non-blocking):", error?.message);
  }
  return result;
}

/**
 * A phone number as typed, trimmed, or undefined when it does not look like
 * one (7-20 digits; spaces, + - ( ) . and an "ext"/"x" suffix allowed).
 */
export function normalizeLeadPhone(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length > 40 || !/^[+\d\s().\-]+((ext\.?|x)\s*\d{1,6})?$/i.test(value)) return undefined;
  const digits = value.replace(/(ext\.?|x)\s*\d+$/i, "").replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 20 ? value : undefined;
}
