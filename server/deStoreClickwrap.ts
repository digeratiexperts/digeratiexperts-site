import { createHash } from "node:crypto";
import type { Request } from "express";
import {
  DE_STORE_PLACE_ORDER_BUTTON,
  DE_STORE_TERMS_VERSION,
  type AgreementAcceptance,
  type BuyerRole,
} from "@shared/deStoreContract";
import {
  BOX_4_PREINSTALLED_SOFTWARE,
  CONSUMER_ESIGN_BOX,
  PREINSTALLED_SOFTWARE_NOTICE,
  SANITIZATION_PUBLIC_STATEMENT,
  box1Label,
  box2Label,
  box4Label,
} from "@shared/deStoreLegalCopy";

export const STORE_DOCUMENT_KEYS = {
  terms: "store-terms",
  matrix: "responsibility-matrix",
  warranty: "limited-warranty",
  returns: "return-and-refund",
  preinstalled: "preinstalled-software",
  esign: "electronic-records-consent",
} as const;

export interface ClickwrapClientInput {
  box1Accepted?: boolean;
  box2Accepted?: boolean;
  box4Accepted?: boolean;
  box6Accepted?: boolean;
  businessName?: string;
  buttonText?: string;
  acceptedAt?: string;
  ip?: string;
}

export interface ClickwrapContext {
  email: string;
  buyerRole: BuyerRole;
  hasHardware: boolean;
  consumerCheckout: boolean;
  accountId?: number;
}

export type ClickwrapFailure = {
  ok: false;
  code: "clickwrap_required" | "clickwrap_invalid";
  error: string;
  missing: string[];
};

export type ClickwrapSuccess = {
  ok: true;
  acceptances: AgreementAcceptance[];
  acceptedAt: string;
  ip: string;
  termsVersion: string;
};

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function stringValue(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function requestIp(req: Pick<Request, "ip">): string {
  return stringValue(req.ip, 200) || "unknown";
}

export function requestUserAgent(req: { get?(name: string): string | undefined }): string {
  return stringValue(req.get?.("user-agent"), 1000) || "unknown";
}

export function recordClickwrapAcceptances(
  client: ClickwrapClientInput | null | undefined,
  context: ClickwrapContext,
  request: { ip: string; userAgent: string; now?: string },
): ClickwrapSuccess | ClickwrapFailure {
  const missing: string[] = [];
  const businessName = stringValue(client?.businessName, 200);
  const box1 = box1Label(context.buyerRole);
  const box2 = box2Label(businessName);
  const box4 = box4Label(context.buyerRole);

  if (!client?.box1Accepted) missing.push("box1");
  if (!client?.box2Accepted) missing.push("box2");
  if (context.hasHardware && !client?.box4Accepted) missing.push("box4");
  if (context.consumerCheckout && !client?.box6Accepted) missing.push("box6");

  const buttonText = stringValue(client?.buttonText, 80);
  if (buttonText !== DE_STORE_PLACE_ORDER_BUTTON) {
    missing.push("buttonText");
  }
  if (!stringValue(context.email, 320)) {
    missing.push("email");
  }
  if (client?.box2Accepted && !businessName) {
    missing.push("businessName");
  }

  if (missing.length) {
    return {
      ok: false,
      code: "clickwrap_required",
      error: "Required acknowledgements are missing. No payment has been taken.",
      missing,
    };
  }

  const acceptedAt = request.now ?? new Date().toISOString();
  const ip = request.ip;
  const userAgent = request.userAgent;
  const common = {
    version: DE_STORE_TERMS_VERSION,
    buttonText: DE_STORE_PLACE_ORDER_BUTTON,
    acceptedAt,
    ip,
    userAgent,
    email: context.email,
    ...(context.accountId != null ? { accountId: context.accountId } : {}),
  };

  const acceptances: AgreementAcceptance[] = [
    {
      documentKey: STORE_DOCUMENT_KEYS.terms,
      hash: sha256(`${box1}\n${box2}`),
      ...common,
    },
    {
      documentKey: STORE_DOCUMENT_KEYS.matrix,
      hash: sha256(box1),
      ...common,
    },
    {
      documentKey: STORE_DOCUMENT_KEYS.warranty,
      hash: sha256(SANITIZATION_PUBLIC_STATEMENT),
      ...common,
    },
    {
      documentKey: STORE_DOCUMENT_KEYS.returns,
      hash: sha256(box1),
      ...common,
    },
  ];

  if (context.hasHardware) {
    acceptances.push({
      documentKey: STORE_DOCUMENT_KEYS.preinstalled,
      hash: sha256(`${box4}\n${PREINSTALLED_SOFTWARE_NOTICE}\n${BOX_4_PREINSTALLED_SOFTWARE}`),
      ...common,
    });
  }
  if (context.consumerCheckout) {
    acceptances.push({
      documentKey: STORE_DOCUMENT_KEYS.esign,
      hash: sha256(CONSUMER_ESIGN_BOX),
      ...common,
    });
  }

  return { ok: true, acceptances, acceptedAt, ip, termsVersion: DE_STORE_TERMS_VERSION };
}
