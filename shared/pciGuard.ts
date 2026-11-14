/**
 * Shared PCI guard: catch cardholder data before it is stored, sent to a
 * model, written to a ticket, or kept in sessionStorage.
 *
 * Detects Luhn-valid PANs (13-19 digits, including numbers split by spaces,
 * dots, dashes, slashes or line breaks) and explicit CVV / card-expiry
 * patterns. Ordinary phone numbers, ZIP codes and ticket or invoice IDs are
 * left alone.
 */

export const CARD_DATA_REJECTED_CODE = "card_data_rejected" as const;
export const CARD_DATA_REJECTED_STATUS = 422;

/** Shown to the visitor. Never includes the submitted value. */
export const CARD_DATA_REJECTED_MESSAGE =
  "Don't enter card numbers, security codes or expiry dates here. Use the official Zoho checkout or the Client Portal payment page instead. Digerati Experts never asks for card details in chat, a ticket or a secure field.";

export const CARD_DATA_REJECTED_TITLE = "Not sent: don't enter card details";

export type CardDataRejection = {
  code: typeof CARD_DATA_REJECTED_CODE;
  error: string;
};

/** Visa, Mastercard, Amex, Discover, JCB, Diners, UnionPay and similar start 2-6. */
function isPlausibleIin(digits: string): boolean {
  const d = digits.charCodeAt(0) - 48;
  return d >= 2 && d <= 6;
}

export function luhnValid(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function isPanSeparator(ch: string): boolean {
  if (!ch) return false;
  if (ch === "." || ch === "-" || ch === "/") return true;
  const code = ch.charCodeAt(0);
  return (
    ch === " " ||
    ch === "\t" ||
    ch === "\n" ||
    ch === "\r" ||
    ch === "\v" ||
    ch === "\f" ||
    code === 0x00a0 ||
    code === 0x2007 ||
    code === 0x202f ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x205f ||
    code === 0x3000
  );
}

function isDigitChar(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function runHasLuhnPan(digits: string): boolean {
  if (digits.length < 13) return false;
  const max = Math.min(19, digits.length);
  for (let len = max; len >= 13; len -= 1) {
    for (let start = 0; start + len <= digits.length; start += 1) {
      const slice = digits.slice(start, start + len);
      if (isPlausibleIin(slice) && luhnValid(slice)) return true;
    }
  }
  return false;
}

export function containsPan(text: string): boolean {
  const source = String(text || "");
  if (!source) return false;
  let i = 0;
  while (i < source.length) {
    if (!isDigitChar(source[i]!)) {
      i += 1;
      continue;
    }
    let digits = "";
    let j = i;
    while (j < source.length) {
      const ch = source[j]!;
      if (isDigitChar(ch)) {
        digits += ch;
        j += 1;
        continue;
      }
      if (isPanSeparator(ch)) {
        j += 1;
        continue;
      }
      break;
    }
    if (runHasLuhnPan(digits)) return true;
    i = j > i ? j : i + 1;
  }
  return false;
}


const CVV_PATTERN =
  /\b(?:cvv2?|cvc2?|cid|cav2|csc|security\s+code|card\s+security\s+code|card\s+code|card\s+verification(?:\s+(?:value|code))?)(?:\s*(?:=|:|->)\s*|\s+(?:(?:is|was)\s+)?)["'`]?(\d{3,4})\b/i;

const CARD_CONTEXT =
  /\b(?:credit\s*(?:and\s+debit\s+)?cards?|debit\s+cards?|cards?|card\s+number|card\s*holder|credit\/debit|visa|mastercard|master\s*card|amex|american\s*express|discover(?:\s+card)?|cvv2?|cvc2?|cid|cav2)\b/i;

const CARD_EXPIRY =
  /\b(?:exp(?:ires?|iry|iration)?(?:\s+date)?|valid\s+(?:thru|until))(?:\s*[=:]\s*|\s+(?:(?:is|was)\s+)?)(0?[1-9]|1[0-2])\s*[/\-]\s*((?:20)?\d{2})\b/i;

export function containsCvvOrCardExpiry(text: string): boolean {
  const source = String(text || "");
  if (!source) return false;
  if (CVV_PATTERN.test(source)) return true;
  return CARD_CONTEXT.test(source) && CARD_EXPIRY.test(source);
}

export function looksLikeCardData(text: string): boolean {
  const source = String(text || "");
  if (!source.trim()) return false;
  return containsPan(source) || containsCvvOrCardExpiry(source);
}

export function rejectCardData(...texts: Array<string | null | undefined>): CardDataRejection | null {
  for (const text of texts) {
    if (looksLikeCardData(String(text || ""))) {
      return { code: CARD_DATA_REJECTED_CODE, error: CARD_DATA_REJECTED_MESSAGE };
    }
  }
  return null;
}

export class CardDataRejectedError extends Error {
  readonly code = CARD_DATA_REJECTED_CODE;
  readonly status = CARD_DATA_REJECTED_STATUS;
  constructor() {
    super(CARD_DATA_REJECTED_MESSAGE);
    this.name = "CardDataRejectedError";
  }
}

export function assertNoCardData(...texts: Array<string | null | undefined>): void {
  if (rejectCardData(...texts)) throw new CardDataRejectedError();
}

export function isCardDataRejection(error: unknown): error is CardDataRejectedError {
  if (error instanceof CardDataRejectedError) return true;
  if (!error || typeof error !== "object") return false;
  const rec = error as { code?: unknown; status?: unknown };
  return rec.code === CARD_DATA_REJECTED_CODE && rec.status === CARD_DATA_REJECTED_STATUS;
}
