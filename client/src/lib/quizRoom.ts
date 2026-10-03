/**
 * Routes that render as a quiz room: one question per screen on a full paper
 * field with their own thin chrome (issue 419). Sitewide interrupters (the
 * sticky assessment bar, the exit-intent popup) stay off these routes so
 * nothing competes with the question being answered.
 */
export const QUIZ_ROOM_PATHS = ["/quote-wizard"] as const;

export function isQuizRoomPath(path: string): boolean {
  const pathname = (path.split(/[?#]/)[0] ?? path).replace(/\/+$/, "") || "/";
  return (QUIZ_ROOM_PATHS as readonly string[]).includes(pathname);
}
