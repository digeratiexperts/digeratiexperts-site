const deskTimestampFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Same date-and-time display for portal tickets and DE Desk comments. */
export function formatDeskTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return deskTimestampFormat.format(date);
}
