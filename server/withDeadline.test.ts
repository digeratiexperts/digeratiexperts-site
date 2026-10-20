import { describe, expect, it } from "vitest";
import { DeadlineError, isDeadlineError, withDeadline } from "./withDeadline";

describe("withDeadline", () => {
  it("passes a value through when the promise settles in time", async () => {
    await expect(withDeadline(Promise.resolve(42), 50, "fast")).resolves.toBe(42);
  });

  it("passes a rejection through unchanged", async () => {
    const boom = new Error("boom");
    await expect(withDeadline(Promise.reject(boom), 50, "failing")).rejects.toBe(boom);
  });

  it("rejects with DeadlineError when the promise never settles", async () => {
    const never = new Promise<never>(() => {});
    const error = await withDeadline(never, 10, "stuck query").catch((e: unknown) => e);
    expect(isDeadlineError(error)).toBe(true);
    expect((error as DeadlineError).message).toBe("stuck query did not finish within 10ms");
    expect((error as DeadlineError).deadlineMs).toBe(10);
  });

  it("recognises only deadline errors", () => {
    expect(isDeadlineError(new Error("timeout"))).toBe(false);
    expect(isDeadlineError(new DeadlineError("x", 1))).toBe(true);
    expect(isDeadlineError("DeadlineError")).toBe(false);
  });
});
