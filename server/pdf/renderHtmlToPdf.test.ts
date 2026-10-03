import { describe, expect, it } from "vitest";
import { createRenderLimiter } from "./renderHtmlToPdf";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PDF render concurrency limiter", () => {
  it("never runs more than the cap at once and serves waiters in order", async () => {
    const acquire = createRenderLimiter(2);
    let running = 0;
    let peak = 0;
    const order: number[] = [];

    const job = async (id: number) => {
      const release = await acquire();
      running += 1;
      peak = Math.max(peak, running);
      order.push(id);
      await tick();
      running -= 1;
      release();
    };

    await Promise.all([1, 2, 3, 4, 5, 6].map(job));
    expect(peak).toBe(2);
    expect(order).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does not let a new caller jump ahead of a woken waiter", async () => {
    const acquire = createRenderLimiter(1);
    const first = await acquire();
    const events: string[] = [];
    const waiter = acquire().then((release) => {
      events.push("waiter");
      return release;
    });
    first();
    // A caller arriving right after the release must queue behind the waiter.
    const late = acquire().then((release) => {
      events.push("late");
      return release;
    });
    const waiterRelease = await waiter;
    await tick();
    expect(events).toEqual(["waiter"]);
    waiterRelease();
    (await late)();
    expect(events).toEqual(["waiter", "late"]);
  });

  it("ignores a double release", async () => {
    const acquire = createRenderLimiter(1);
    const release = await acquire();
    release();
    release();
    const a = await acquire();
    let secondGotSlot = false;
    const b = acquire().then((r) => {
      secondGotSlot = true;
      return r;
    });
    await tick();
    expect(secondGotSlot).toBe(false);
    a();
    (await b)();
  });
});
