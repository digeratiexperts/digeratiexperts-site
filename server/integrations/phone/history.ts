import { CYTRACOM_BASE_URL } from "./cytracom";
import type { PhoneCall, PhoneHistory } from "./types";

// https://help.cytracom.com/hc/en-us/articles/360022377692-API-Insights
// Read-only searches use POST. Never return raw vendor records to a client.
type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const text = (value: unknown): string => typeof value === "string" ? value : "";

function personalCall(value: unknown, extension: string, start: number, end: number): PhoneCall | null {
  const raw = object(value);
  if (!Array.isArray(raw.legs)) return null;
  const belongs = raw.legs.some(leg => {
    const row = object(leg);
    return [object(row.caller), object(row.callee)].some(endpoint =>
      endpoint.type === "extension" && String(endpoint.number) === extension);
  });
  const date = Date.parse(text(raw.started_on));
  const id = text(raw.linked_id);
  if (!belongs || !id || !Number.isFinite(date) || date < start || date > end ||
      !["inbound", "outbound", "internal"].includes(text(raw.direction)) ||
      typeof raw.duration !== "number" || !Number.isFinite(raw.duration) || raw.duration < 0 ||
      typeof raw.answered !== "boolean") return null;
  // Only the remote number's last four digits leave the server, never caller ID names.
  const callerId = text(raw.original_caller_id);
  const remote = raw.direction === "inbound" ? (callerId.match(/<\+?([\d ()-]+)>/)?.[1] ?? "")
    : raw.direction === "outbound" ? text(raw.dialed_number) : "";
  const digits = remote.replace(/\D/g, "");
  return {
    id, startedAt: new Date(date).toISOString(), direction: raw.direction as PhoneCall["direction"],
    durationSeconds: raw.duration, answered: raw.answered,
    number: digits.length >= 4 ? `•••• ${digits.slice(-4)}` : null,
  };
}

export async function loadCytracomHistory(
  token: string, extension: string | null, fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<PhoneHistory> {
  const end = now();
  const start = new Date(end.getTime() - 7 * 86_400_000);
  const result: PhoneHistory = { status: extension ? "ok" : "not_assigned", since: start.toISOString(), until: end.toISOString(), calls: [], truncated: false };
  if (!extension) return result;
  const signal = AbortSignal.timeout(25_000);
  const auth = `Basic ${Buffer.from(`token:${token}`, "utf8").toString("base64")}`;
  let cursor = "";
  let read = 0;
  let total = 0;
  const calls = new Map<string, PhoneCall>();
  try {
    for (let page = 0; page < 5; page++) {
      const response = await fetchImpl(`${CYTRACOM_BASE_URL}/insights/${page ? "scroll" : "search"}`, {
        method: "POST", redirect: "error", signal,
        headers: { authorization: auth, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(page ? { scroll_id: cursor, scroll_expires: "1m" } : {
          query: { date_range: { start: result.since, end: result.until } },
          options: { size: 100, scroll: "true" },
        }),
      });
      if (!response.ok) throw new Error();
      const body = object(await response.json());
      const data = object(body.data), search = object(data.search);
      if (body.code !== 200 || !Array.isArray(search.records) || typeof data.total !== "number" ||
          data.total < 0 || !Number.isFinite(data.total) || typeof search.scroll_id !== "string") throw new Error();
      total = data.total;
      read += search.records.length;
      for (const row of search.records) {
        const call = personalCall(row, extension, start.getTime(), end.getTime());
        if (call) calls.set(call.id, call);
      }
      cursor = search.scroll_id;
      if (!cursor || !search.records.length || read >= total) break;
    }
  } catch {
    // Never propagate token, cursor, caller names or vendor response bodies.
    throw new Error("Call history unavailable");
  }
  result.calls = [...calls.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 100);
  result.truncated = read < total || calls.size > 100;
  return result;
}
