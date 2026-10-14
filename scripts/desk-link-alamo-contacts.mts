// Files the three Alamo contacts under the "Alamo Industries" Zoho Desk account
// once DE has created it, so the Alamo portal sees their tickets.
//
// Dry run by default, and a dry run makes NO Zoho Desk call: it prints the plan.
// Pass --state to preview the plan against a saved snapshot of Desk (JSON).
// Only --apply reads Desk live and then writes; it writes nothing when the
// account is missing or ambiguous, and never moves a contact that is already
// under another account.
//
// Usage:
//   npx tsx scripts/desk-link-alamo-contacts.mts --emails a@x.com,b@x.com,c@x.com
//   npx tsx scripts/desk-link-alamo-contacts.mts --emails ... --state desk-snapshot.json
//   npx tsx scripts/desk-link-alamo-contacts.mts --emails ... --apply     # live: reads, then writes
// Options: --account "<Desk account name>" (default "Alamo Industries").
// Snapshot shape: { "accounts": [{ "id", "accountName" }], "contacts": { "<email>": [{ "id", "email", "firstName", "lastName", "accountId"? }] } }
//
// Credentials: the server's Desk settings, read by server/zoho/zohoClient.ts.
// This script prints names, emails and Desk ids only, never a token or secret.
import { readFileSync } from "node:fs";
import {
  formatLinkPlan,
  normalizeEmail,
  parseEmailList,
  planContactAccountLinks,
} from "../server/deskContactAccountLink";
import type { ZohoDeskAccount, ZohoDeskContact } from "../server/zoho/zohoDesk";

const DEFAULT_ACCOUNT = "Alamo Industries";
const EXPECTED_CONTACTS = 3;

function arg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : undefined;
}

const apply = process.argv.includes("--apply");
const accountName = arg("account") ?? DEFAULT_ACCOUNT;
const statePath = arg("state");
const { emails, invalid } = parseEmailList(arg("emails") ?? "");

if (invalid.length) {
  console.error(`Not an email address: ${invalid.join(", ")}`);
  process.exit(2);
}
if (emails.length === 0) {
  console.error("Pass the Alamo contacts' emails: --emails a@example.com,b@example.com,c@example.com");
  process.exit(2);
}
if (apply && statePath) {
  console.error("--state is for previews; --apply always reads Desk live. Pass one or the other.");
  process.exit(2);
}
if (emails.length !== EXPECTED_CONTACTS) {
  console.warn(`Note: ${emails.length} email(s) given; the backlog item names ${EXPECTED_CONTACTS} Alamo contacts.`);
}

async function main(): Promise<number> {
  if (!apply && !statePath) {
    console.log(`DRY RUN, offline: no Zoho Desk call was made.`);
    console.log(`With --apply this script will:`);
    console.log(`1. Find the Desk account named "${accountName}" (exact name, ignoring case, punctuation and Inc/LLC). If none or more than one, stop with no change.`);
    console.log(`2. Find the Desk contact for each email:`);
    for (const e of emails) console.log(`   - ${e}`);
    console.log(`3. For each email with exactly one contact that is under no account: set that contact's account to "${accountName}".`);
    console.log(`   A contact already under "${accountName}" is left alone; one under another account is reported, not moved.`);
    console.log(`Preview against a Desk snapshot with --state <file.json>.`);
    return 0;
  }

  let accounts: ZohoDeskAccount[];
  let contactsByEmail: Record<string, ZohoDeskContact[]>;

  if (statePath) {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      accounts?: ZohoDeskAccount[];
      contacts?: Record<string, ZohoDeskContact[]>;
    };
    accounts = state.accounts ?? [];
    contactsByEmail = Object.fromEntries(
      Object.entries(state.contacts ?? {}).map(([email, list]) => [normalizeEmail(email), list]),
    );
    console.log(`DRY RUN against snapshot ${statePath}: no Zoho Desk call was made.`);
  } else {
    // --apply: only now load the Desk client, so a dry run cannot reach Zoho.
    const { zohoClient } = await import("../server/zoho/zohoClient");
    if (!zohoClient.isDeskConfigured()) {
      console.error(`Zoho Desk is not configured on this server (status: ${zohoClient.getDeskAuthStatus()}). Nothing changed.`);
      return 1;
    }
    const client = await zohoClient.getDeskClient();
    const orgs = await client.get("/organizations");
    const orgId: string | undefined = orgs.data?.data?.[0]?.id;
    if (!orgId) {
      console.error("No Zoho Desk organization found. Nothing changed.");
      return 1;
    }
    const headers = { orgId };
    const found = await client.get("/accounts/search", { headers, params: { accountName, limit: 50 } });
    accounts = found.data?.data ?? [];
    contactsByEmail = {};
    for (const email of emails) {
      const reply = await client.get("/contacts/search", { headers, params: { email, limit: 10 } });
      contactsByEmail[email] = reply.data?.data ?? [];
    }

    const plan = planContactAccountLinks({ accountName, accounts, emails, contactsByEmail });
    console.log(formatLinkPlan(plan, { apply: true }));
    if (plan.account.state !== "found") return 1;

    let failed = 0;
    for (const step of plan.writes) {
      try {
        await client.patch(`/contacts/${step.contactId}`, { accountId: plan.account.id }, { headers });
        console.log(`LINKED ${step.email} (contact ${step.contactId}) -> ${plan.account.name}`);
      } catch (error: any) {
        failed++;
        const status = error?.response?.status ?? "no response";
        const code = error?.response?.data?.errorCode ?? error?.code ?? "";
        console.error(`FAILED ${step.email} (contact ${step.contactId}): HTTP ${status} ${code}`.trim());
      }
    }
    console.log(`Done: ${plan.writes.length - failed} linked, ${failed} failed.`);
    return failed ? 1 : 0;
  }

  const plan = planContactAccountLinks({ accountName, accounts, emails, contactsByEmail });
  console.log(formatLinkPlan(plan, { apply: false }));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: any) => {
    // Transport or auth failure: report the status only, never request headers.
    console.error(`Stopped: ${error?.response?.status ? `HTTP ${error.response.status}` : error?.message ?? "error"}. Nothing further was changed.`);
    process.exit(1);
  },
);
