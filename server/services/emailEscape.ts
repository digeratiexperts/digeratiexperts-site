/**
 * Escape a value for an HTML email body or attribute. Every caller-supplied
 * value in a notification template goes through this: lead names, messages,
 * ticket subjects and alert text come from website visitors or other systems,
 * and unescaped they let anyone inject markup or links into mail DE staff and
 * clients receive.
 */
export function escapeEmailHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}
