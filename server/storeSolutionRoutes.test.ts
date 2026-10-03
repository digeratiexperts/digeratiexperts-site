import { describe, expect, it } from "vitest";
import { registerStoreSolutionRoutes } from "./storeSolutionRoutes";
import { getSolution, upsertSolution } from "./storeSolutionStore";

type Handler = (req: any, res: any) => unknown;

function captureRoutes() {
  const routes = new Map<string, Handler>();
  const app = {
    get: (path: string, ...handlers: Handler[]) => routes.set(`GET ${path}`, handlers[handlers.length - 1]),
    put: (path: string, ...handlers: Handler[]) => routes.set(`PUT ${path}`, handlers[handlers.length - 1]),
    post: (path: string, ...handlers: Handler[]) => routes.set(`POST ${path}`, handlers[handlers.length - 1]),
  };
  registerStoreSolutionRoutes(app as any, (_req, _res, next) => next());
  return routes;
}

function mockResponse() {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(payload: any) {
      out.body = payload;
      return res;
    },
  };
  return { res, out };
}

describe("PUT /api/store/solutions/current ownership (#244)", () => {
  const put = captureRoutes().get("PUT /api/store/solutions/current")!;

  it("answers 403 and leaves the record alone when another session names its id", async () => {
    const victim = upsertSolution({ sessionId: "route-victim", items: [{ productId: "prod-010", quantity: 4 }] });
    const { res, out } = mockResponse();
    await put(
      { headers: {}, query: {}, body: { id: victim.id, sessionId: "route-attacker", items: [] } },
      res,
    );
    expect(out.status).toBe(403);
    expect(out.body.code).toBe("SOLUTION_OWNERSHIP_MISMATCH");
    expect(JSON.stringify(out.body)).not.toContain("prod-010");
    const after = getSolution(victim.id)!;
    expect(after.sessionId).toBe("route-victim");
    expect(after.items).toEqual([{ productId: "prod-010", quantity: 4 }]);
  });

  it("saves for the owning session", async () => {
    const mine = upsertSolution({ sessionId: "route-owner", items: [] });
    const { res, out } = mockResponse();
    await put(
      {
        headers: {},
        query: {},
        body: { id: mine.id, sessionId: "route-owner", items: [{ productId: "prod-010", quantity: 2 }] },
      },
      res,
    );
    expect(out.status).toBe(200);
    expect(out.body.solution.id).toBe(mine.id);
    expect(out.body.solution.items).toEqual([{ productId: "prod-010", quantity: 2 }]);
  });
});
