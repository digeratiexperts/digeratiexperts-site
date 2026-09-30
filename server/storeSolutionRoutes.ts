import type { Express, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  claimSolutionDurable,
  createSolution,
  findSolutionDurable,
  publicSolution,
  upsertSolutionDurable,
} from "./storeSolutionStore";
import type { SolutionLineInput } from "@shared/storeCommerce";
import { getJwtSecretOrNull } from "./config/authSecrets";

type SolutionRequest = Request & {
  userId?: string;
  user?: { id?: string };
};

function readSessionId(req: Request): string {
  const fromBody = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  const fromQuery = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
  return (fromBody || fromQuery).slice(0, 80);
}

function optionalUserId(req: SolutionRequest): string | null {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const secret = getJwtSecretOrNull();
  if (!token || !secret) return req.userId ?? null;
  try {
    const decoded = jwt.verify(token, secret) as { userId?: string };
    return decoded.userId || req.userId || null;
  } catch {
    return req.userId ?? null;
  }
}

function parseLines(value: unknown): SolutionLineInput[] {
  if (!Array.isArray(value)) return [];
  const lines: SolutionLineInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const sku = typeof item.sku === "string" ? item.sku.trim() : undefined;
    const quantity = Number(item.quantity);
    if (!productId || !Number.isFinite(quantity)) continue;
    lines.push({ productId, sku, quantity });
  }
  return lines.slice(0, 50);
}

export function registerStoreSolutionRoutes(
  app: Express,
  authMiddleware: (req: SolutionRequest, res: Response, next: NextFunction) => unknown,
) {
  app.get("/api/store/solutions/current", async (req: SolutionRequest, res: Response) => {
    const sessionId = readSessionId(req);
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const userId = optionalUserId(req);
    const existing = await findSolutionDurable({ sessionId, userId });
    if (!existing) {
      return res.json({ solution: publicSolution(createSolution(sessionId, userId)) });
    }
    return res.json({ solution: publicSolution(existing) });
  });

  app.put("/api/store/solutions/current", async (req: SolutionRequest, res: Response) => {
    const sessionId = readSessionId(req);
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const userId = optionalUserId(req);
    const items = parseLines(req.body?.items);
    const savedForLater = parseLines(req.body?.savedForLater);
    const name = typeof req.body?.name === "string" ? req.body.name.slice(0, 80) : undefined;
    const solution = await upsertSolutionDurable({
      id: typeof req.body?.id === "string" ? req.body.id : undefined,
      sessionId,
      userId,
      name,
      items,
      savedForLater,
    });
    return res.json({ solution: publicSolution(solution) });
  });

  app.post("/api/store/solutions/claim", authMiddleware, async (req: SolutionRequest, res: Response) => {
    const sessionId = readSessionId(req);
    const userId = req.userId || req.user?.id;
    if (!sessionId || !userId) {
      return res.status(400).json({ error: "sessionId and authenticated user are required" });
    }
    const solution = await claimSolutionDurable(sessionId, userId);
    return res.json({ solution: publicSolution(solution) });
  });
}
