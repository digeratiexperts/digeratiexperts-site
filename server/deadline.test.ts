import { describe, expect, it } from "vitest";
import { DeadlineError, withDeadline } from "./deadline";

describe("withDeadline", () => {
  it("passes a value that arrives in time", async () => {
    expect(await withDeadline(Promise.resolve("ok"), 50, "fast read")).toBe("ok");
  });

  it("rejects with DeadlineError when the work never settles", async () => {
    const never = new Promise<string>(() => {});
    await expect(withDeadline(never, 20, "stuck read")).rejects.toMatchObject({
      name: "DeadlineError",
      message: "stuck read did not answer within 20 ms",
    });
  });

  it("passes the work's own rejection through unchanged", async () => {
    await expect(withDeadline(Promise.reject(new Error("boom")), 50, "read")).rejects.toThrow("boom");
  });

  it("leaves a late rejection handled, so it cannot crash the process", async () => {
    let rejectLate!: (error: Error) => void;
    const late = new Promise<never>((_, reject) => {
      rejectLate = reject;
    });
    await expect(withDeadline(late, 10, "late read")).rejects.toBeInstanceOf(DeadlineError);
    // Vitest fails the run on an unhandled rejection; this one must not be one.
    rejectLate(new Error("too late"));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
