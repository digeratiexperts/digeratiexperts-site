import { esc } from "./base.mjs";

const PLACEHOLDER = "[DE_PUBLIC_PHONE]";
const retired = new Set(["4805195892", "8555349832", "3254809870"]);

/** Public DE contact only. Never build a callable URI from a pending token. */
export function publicPhoneMarkup(cta) {
  const phone = String(cta.phone ?? "");
  const href = String(cta.phoneHref ?? "");
  const digits = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (!/^\d{10}$/.test(digits) || retired.has(digits) || href !== `tel:+1${digits}`) {
    return `<span>${PLACEHOLDER}</span>`;
  }
  return `<a href="${esc(href)}">${esc(phone)}</a>`;
}
