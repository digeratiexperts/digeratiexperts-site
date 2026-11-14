/**
 * Harden the SPA shell on payment/checkout routes: no marketing inline
 * scripts, Cloudflare Rocket Loader off, and optional CSP nonces so
 * production payment pages can drop script-src 'unsafe-inline'.
 */

const JSON_LD_SCRIPT = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;
const CONSENT_SCRIPT = /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?(?:dataLayer|function gtag\()[\s\S]*?<\/script>/gi;
const FONT_ONLOAD = /\s+onload="this\.media='all'"/g;
const FONT_PRINT_MEDIA = /(<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*" rel="stylesheet") media="print"/g;

export function preparePaymentPageHtml(html: string, nonce?: string | null): string {
  let out = String(html || "");
  out = out.replace(JSON_LD_SCRIPT, "");
  out = out.replace(CONSENT_SCRIPT, "");
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
