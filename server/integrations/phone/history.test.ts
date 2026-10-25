import { describe, expect, it, vi } from "vitest";
import { loadCytracomHistory } from "./history";

// Synthetic records using the documented data.search.records and leg endpoints.
const call = (id: string, extension = "201", overrides = {}) => ({
  linked_id: id, started_on: "2026-10-25T12:00:00Z", direction: "inbound",
  duration: 84, answered: true, original_caller_id: '"Private name" <+12145551234>',
  recording_url: "https://private.invalid/recording", customer_id: 42,
  legs: [{ callee: { type: "extension", number: extension }, caller: { number: "2145551234" } }],
  ...overrides,
});
const response = (records: unknown[], total = records.length, scroll_id = "") =>
  new Response(JSON.stringify({ data: { total, search: { records, scroll_id } }, code: 200 }));

describe("Cytracom personal call history", () => {
  it("filters other extensions and strips names, full numbers and vendor details", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response([call("mine"), call("other", "202")]));
    const result = await loadCytracomHistory("test-token", "201", fetcher, () => new Date("2026-10-25T13:00:00Z"));
    expect(result.status).toBe("ok");
    expect(result.calls).toEqual([{ id: "mine", startedAt: "2026-10-25T12:00:00.000Z", direction: "inbound", durationSeconds: 84, answered: true, number: "•••• 1234" }]);
    expect(JSON.stringify(result)).not.toMatch(/Private name|214555|recording|customer_id|test-token/);
    const init = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string).options).toEqual({ size: 100, scroll: "true" });
  });
  it("does not call the vendor when the user has no assigned extension", async () => {
    const fetcher = vi.fn();
    expect((await loadCytracomHistory("token", null, fetcher)).status).toBe("not_assigned");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reads subsequent pages with the same account token and deduplicates calls", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response([call("one")], 3, "cursor"))
      .mockResolvedValueOnce(response([call("one"), call("two")], 3));
    const result = await loadCytracomHistory("test-token", "201", fetcher, () => new Date("2026-10-25T13:00:00Z"));
    expect(result.calls.map(c => c.id)).toEqual(["one", "two"]);
    expect(fetcher.mock.calls[1][0]).toContain("/insights/scroll");
    expect(fetcher.mock.calls[0][1].headers.authorization).toBe(fetcher.mock.calls[1][1].headers.authorization);
  });
  it("bounds pagination and explicitly marks an incomplete result", async () => {
    const fetcher = vi.fn(async () => response([call("one")], 999, "cursor"));
    const result = await loadCytracomHistory("token", "201", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(result.truncated).toBe(true);
  });
  it("rejects malformed and failed responses without exposing vendor errors", async () => {
    for (const body of [new Response("token secret", { status: 401 }), new Response('{"data":{"search":{}}}')]) {
      await expect(loadCytracomHistory("token", "201", vi.fn(async () => body))).rejects.toThrow(/Call history unavailable/);
    }
  });
  it("omits invalid call fields and does not invent answered state", async () => {
    const fetcher = vi.fn(async () => response([
      call("bad", "201", { started_on: "not-a-date" }),
      call("unknown", "201", { answered: undefined, duration: -1, direction: "surprise" }),
    ]));
    const result = await loadCytracomHistory("token", "201", fetcher);
    expect(result.calls).toHaveLength(0);
  });
});
