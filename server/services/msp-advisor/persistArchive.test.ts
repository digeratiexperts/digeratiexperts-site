import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendDeskMessage,
  archiveDeskSessions,
  archiveFolderFor,
  deleteDeskSession,
  getDeskSessionMessages,
  listDeskSessions,
  NO_COMPANY_FOLDER,
  sessionIdsInSameCompany,
  unarchiveDeskSession,
} from "./persist";

/**
 * Joe, 2026-10-07: archive or delete a DE Desk chat from the right-click menu,
 * and the archive files every chat from a company into that company's folder.
 * These run on the in-memory store (no database in tests).
 */
describe("DE Desk archive folders", () => {
  it("files non-answers to the company question into one No company folder", () => {
    for (const raw of [null, "", "none", "No company", "Walk-in", "just myself", "  N/A "]) {
      assert.equal(archiveFolderFor(raw), NO_COMPANY_FOLDER);
    }
    assert.equal(archiveFolderFor("  Acme   Corp. "), "Acme Corp");
  });

  it("archives, lists by folder, merges spellings, revives on a visitor message, and deletes", async () => {
    const tag = Math.random().toString(36).slice(2);
    const a = `arch-a-${tag}`;
    const b = `arch-b-${tag}`;
    const c = `arch-c-${tag}`;
    await appendDeskMessage({ sessionId: a, role: "user", content: "hi", companyName: `Acme ${tag}` });
    await appendDeskMessage({ sessionId: b, role: "user", content: "hello", companyName: `acme  ${tag}` });
    await appendDeskMessage({ sessionId: c, role: "user", content: "hey", companyName: "none" });

    const sameCompany = await sessionIdsInSameCompany(a);
    assert.deepEqual([...sameCompany].sort(), [a, b].sort());

    const archived = await archiveDeskSessions(sameCompany);
    // "Acme x" and "acme  x" share one folder (whichever spelling came first names it).
    const folders = [...new Set(archived.map((s) => s.archiveFolder))];
    assert.equal(folders.length, 1);
    assert.equal(folders[0]?.toLowerCase(), `acme ${tag}`);

    const live = (await listDeskSessions({ limit: 200 })).map((s) => s.sessionId);
    assert.ok(live.includes(c));
    assert.ok(!live.includes(a));
    const inArchive = (await listDeskSessions({ archived: true })).map((s) => s.sessionId);
    assert.ok(inArchive.includes(a) && inArchive.includes(b));
    const everything = (await listDeskSessions({ archived: "all", limit: 200 })).map((s) => s.sessionId);
    assert.ok([a, b, c].every((id) => everything.includes(id)));

    // The visitor writes again: the chat leaves the archive.
    await appendDeskMessage({ sessionId: a, role: "user", content: "still there?" });
    assert.equal((await getDeskSessionMessages(a)).session?.archivedAt, null);

    assert.equal((await unarchiveDeskSession(b))?.archivedAt, null);

    const [noCompany] = await archiveDeskSessions([c]);
    assert.equal(noCompany.archiveFolder, NO_COMPANY_FOLDER);

    assert.equal(await deleteDeskSession(c), true);
    assert.equal((await getDeskSessionMessages(c)).session, null);
    assert.equal(await deleteDeskSession(c), false);
  });
});
