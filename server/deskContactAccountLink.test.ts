import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatLinkPlan, parseEmailList, planContactAccountLinks } from "./deskContactAccountLink";

const ALAMO = { id: "acc-1", accountName: "Alamo Industries" };
const contact = (id: string, email: string, accountId?: string) => ({
  id,
  email,
  firstName: "Pat",
  lastName: id,
  phone: "",
  ...(accountId ? { accountId } : {}),
});
const emails = ["a@alamo.example", "b@alamo.example", "c@alamo.example"];

describe("Desk contact to account plan", () => {
  it("links contacts with no account once the account exists", () => {
    const plan = planContactAccountLinks({
      accountName: "Alamo Industries",
      accounts: [{ id: "acc-1", accountName: "Alamo Industries, Inc." }],
      emails,
      contactsByEmail: {
        "a@alamo.example": [contact("1", "a@alamo.example")],
        "b@alamo.example": [contact("2", "B@Alamo.example")],
        "c@alamo.example": [contact("3", "c@alamo.example", "acc-1")],
      },
    });
    expect(plan.account).toEqual({ state: "found", id: "acc-1", name: "Alamo Industries, Inc." });
    expect(plan.steps.map((s) => s.action)).toEqual(["link", "link", "already-linked"]);
    expect(plan.writes.map((s) => s.contactId)).toEqual(["1", "2"]);
  });

  it("writes nothing while the account does not exist", () => {
    const plan = planContactAccountLinks({
      accountName: "Alamo Industries",
      accounts: [{ id: "x", accountName: "Alamo Ranch" }],
      emails,
      contactsByEmail: { "a@alamo.example": [contact("1", "a@alamo.example")] },
    });
    expect(plan.account.state).toBe("missing");
    expect(plan.writes).toEqual([]);
    expect(formatLinkPlan(plan, { apply: false })).toContain("NOT FOUND");
  });

  it("writes nothing when two accounts share the name", () => {
    const plan = planContactAccountLinks({
      accountName: "Alamo Industries",
      accounts: [ALAMO, { id: "acc-2", accountName: "Alamo Industries LLC" }],
      emails,
      contactsByEmail: { "a@alamo.example": [contact("1", "a@alamo.example")] },
    });
    expect(plan.account.state).toBe("ambiguous");
    expect(plan.writes).toEqual([]);
  });

  it("never moves a contact from another account, and skips missing or duplicate contacts", () => {
    const plan = planContactAccountLinks({
      accountName: "Alamo Industries",
      accounts: [ALAMO, { id: "acc-9", accountName: "Other Co" }],
      emails,
      contactsByEmail: {
        "a@alamo.example": [contact("1", "a@alamo.example", "acc-9")],
        "b@alamo.example": [contact("2", "b@alamo.example"), contact("4", "b@alamo.example")],
        // A search hit whose email is different is not the contact.
        "c@alamo.example": [contact("5", "someone-else@alamo.example")],
      },
    });
    expect(plan.steps.map((s) => s.action)).toEqual(["linked-elsewhere", "several-contacts", "no-contact"]);
    expect(plan.steps[0].currentAccountName).toBe("Other Co");
    expect(plan.writes).toEqual([]);
  });

  it("parses, de-duplicates and lower-cases the email list", () => {
    expect(parseEmailList(" A@x.com, a@x.com;b@x.com  not-an-email ")).toEqual({
      emails: ["a@x.com", "b@x.com"],
      invalid: ["not-an-email"],
    });
  });
});

describe("desk-link-alamo-contacts script", () => {
  const script = path.resolve(__dirname, "../scripts/desk-link-alamo-contacts.mts");
  const src = readFileSync(script, "utf8");
  const run = (args: string[]) =>
    execFileSync(process.execPath, ["--import", "tsx", script, ...args], {
      encoding: "utf8",
      // No Desk credentials: a dry run must not need them or try to use them.
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test" },
    });

  it("loads the Zoho client only on --apply", () => {
    expect(src).not.toMatch(/^import .*zohoClient/m);
    expect(src).toMatch(/if \(!apply && !statePath\)[\s\S]*?return 0;/);
    expect(src).toMatch(/\/\/ --apply: only now load the Desk client[\s\S]*await import\("..\/server\/zoho\/zohoClient"\)/);
  });

  it("dry run prints the plan and makes no Desk call", () => {
    const out = run(["--emails", emails.join(",")]);
    expect(out).toContain("no Zoho Desk call was made");
    expect(out).toContain('Find the Desk account named "Alamo Industries"');
    for (const e of emails) expect(out).toContain(e);
  }, 30_000);

  it("previews against a snapshot without calling Desk", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "desk-link-"));
    const state = path.join(dir, "desk.json");
    writeFileSync(
      state,
      JSON.stringify({
        accounts: [ALAMO],
        contacts: { "a@alamo.example": [contact("1", "a@alamo.example")], "b@alamo.example": [contact("2", "b@alamo.example")] },
      }),
    );
    const out = run(["--emails", emails.join(","), "--state", state]);
    expect(out).toContain("Desk account: Alamo Industries (acc-1)");
    expect(out).toContain("Planned Desk changes: 2");
    expect(out).toContain("SKIP (no Desk contact with this email)");
    expect(out).toContain("pass --apply");
  }, 30_000);
});
