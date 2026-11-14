/**
 * Harden the SPA shell on payment/checkout routes: no marketing inline
 * scripts, Cloudflare Rocket Loader off, and optional CSP nonces so
 * production payment pages can drop script-src 'unsafe-inline'.
 */

const FONT_ONLOAD = /\s+onload="this\.media='all'"/g;
const FONT_PRINT_MEDIA = /(<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet") media="print"/g;

function stripScriptsMatching(html: string, shouldStrip: (openTag: string, body: string) => boolean): string {
  const lower = html.toLowerCase();
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const start = lower.indexOf("<script", cursor);
    if (start === -1) {
      chunks.push(html.slice(cursor));
      break;
    }
    const nextChar = lower[start + 7];
    if (nextChar && !/[\s>/]/.test(nextChar)) {
      chunks.push(html.slice(cursor, start + 7));
      cursor = start + 7;
      continue;
    }
    const openEnd = html.indexOf(">", start);
    if (openEnd === -1) {
      chunks.push(html.slice(cursor));
      break;
    }
    const closeStart = lower.indexOf("</script", openEnd + 1);
    if (closeStart === -1) {
      chunks.push(html.slice(cursor));
      break;
    }
    const closeEnd = html.indexOf(">", closeStart);
    if (closeEnd === -1) {
      chunks.push(html.slice(cursor));
      break;
    }
    const openTag = html.slice(start, openEnd + 1);
    const body = html.slice(openEnd + 1, closeStart);
    chunks.push(html.slice(cursor, start));
    if (!shouldStrip(openTag, body)) {
      chunks.push(html.slice(start, closeEnd + 1));
    }
    cursor = closeEnd + 1;
  }

  return chunks.join("");
}

function isMarketingScript(openTag: string, body: string): boolean {
  const tagLower = openTag.toLowerCase();
  if (/type\s*=\s*["']application\/ld\+json["']/.test(tagLower)) {
    return true;
  }
  if (!/\bsrc\s*=/.test(tagLower) && (body.includes("dataLayer") || body.includes("function gtag("))) {
    return true;
  }
  return false;
}

export function preparePaymentPageHtml(html: string, nonce?: string | null): string {
  let out = String(html || "");
  out = stripScriptsMatching(out, isMarketingScript);
  out = out.replace(/<!--\s*Google Consent Mode v2[\s\S]*?-->/gi, "");
  out = out.replace(/<!--\s*Structured Data for Local Business\s*-->/gi, "");
  out = out.replace(FONT_ONLOAD, "");
  out = out.replace(FONT_PRINT_MEDIA, "$1");
  out = out.replace(/<script\b([^>]*)>/gi, (_all, attrs: string) => {
    let a = attrs || "";
    if (!/\bdata-cfasync\s*=/i.test(a)) {
      a += ' data-cfasync="false"';
    }
    if (nonce && !/\bnonce\s*=/i.test(a)) {
      a += ` nonce="${nonce}"`;
    }
    return `<script${a}>`;
  });
  return out;
}
