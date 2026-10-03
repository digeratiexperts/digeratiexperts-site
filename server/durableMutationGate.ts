import type { NextFunction, Request, Response } from "express";
import { requireDurableStorage } from "./storage";

/**
 * Routes whose writes land in `storage` (#248). In production they answer 503
 * when the database is not connected instead of accepting a record that exists
 * only in one Node process. Matched by path so legacy route bodies stay untouched.
 */
export const DURABLE_MUTATION_PATHS: RegExp[] = [
  /^\/api\/(workspaces|projects|boards|tasks|labels|comments|chat)(\/|$)/,
  /^\/api\/portal\/tickets(\/|$)/,
  /^\/api\/portal\/admin\/companies\/[^/]+\/files(\/|$)/,
];

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isDurableMutation(method: string, path: string): boolean {
  return MUTATING.has(method.toUpperCase()) && DURABLE_MUTATION_PATHS.some((re) => re.test(path));
}

export function durableMutationGate(req: Request, res: Response, next: NextFunction): unknown {
  if (!isDurableMutation(req.method, req.path)) return next();
  return requireDurableStorage(req, res, next);
}
