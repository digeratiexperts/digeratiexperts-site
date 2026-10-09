/**
 * Client Portal agreement gate: what a signed-in client must accept before
 * using the portal, and the welcome videos shown above it.
 *
 * Two scopes, signed separately:
 *   company  signed once for the whole company by someone who can bind it
 *            (an org admin / company IT contact). Until it is signed, nobody
 *            at that company gets past the gate.
 *   user     signed by every person, for themselves.
 *
 * Raising `version` asks everyone to sign again; the gate then says the
 * document "has been updated". The PDFs are built by the DE document system
 * (scripts/de-documents/content/portal-agreements.mts) and published at `pdf`.
 */

export type AgreementScope = "company" | "user";

export interface PortalAgreement {
  key: string;
  version: string;
  scope: AgreementScope;
  title: string;
  /** One sentence for the gate card. */
  summary: string;
  /** Public path of the published PDF (client/public + this path). */
  pdf: string;
  lastModified: string;
}

export const PORTAL_AGREEMENTS: PortalAgreement[] = [
  {
    key: "portal-terms",
    version: "2026.10",
    scope: "company",
    title: "Client Portal Terms, Legal Disclaimers and Rules of Engagement",
    summary:
      "How Digerati Experts and your company work together through this portal: who may act for the company, how requests become work, what the portal is and is not, and the legal terms that apply.",
    pdf: "/assets/legal/portal/client-portal-terms-and-rules-of-engagement.pdf",
    lastModified: "2026-10-09",
  },
  {
    key: "portal-acceptable-use",
    version: "2026.10",
    scope: "user",
    title: "Client Portal Acceptable Use Policy",
    summary: "What you may and may not do with your portal account, and how we protect your company's information.",
    pdf: "/assets/legal/portal/client-portal-acceptable-use-policy.pdf",
    lastModified: "2026-10-09",
  },
  {
    key: "portal-guide",
    version: "2026.10",
    scope: "user",
    title: "Client Portal Guide",
    summary: "How to get help, track requests, find your documents and keep your account secure.",
    pdf: "/assets/legal/portal/client-portal-guide.pdf",
    lastModified: "2026-10-09",
  },
];

export function agreementByKey(key: string): PortalAgreement | undefined {
  return PORTAL_AGREEMENTS.find((a) => a.key === key);
}

/** A recorded signature (no evidence fields; those stay server-side). */
export interface AgreementSignatureRef {
  key: string;
  version: string;
  scope: AgreementScope;
  signerName: string;
  signedAt: string;
}

export type AgreementState = "signed" | "outstanding" | "updated" | "awaiting_company";

export interface AgreementGateItem extends PortalAgreement {
  state: AgreementState;
  /** Whether this person may sign it now. */
  canSign: boolean;
  signature: AgreementSignatureRef | null;
}

export interface AgreementGateStatus {
  /** Nothing outstanding for this person. */
  complete: boolean;
  /** The person can sign everything still outstanding themselves. */
  canFinish: boolean;
  /** This person may sign company agreements. */
  isCompanySigner: boolean;
  items: AgreementGateItem[];
}

/**
 * Work out what is outstanding. `company` and `user` hold every signature on
 * record for the company and the person, any version.
 */
export function agreementGateStatus(input: {
  company: AgreementSignatureRef[];
  user: AgreementSignatureRef[];
  isCompanySigner: boolean;
  agreements?: PortalAgreement[];
}): AgreementGateStatus {
  const agreements = input.agreements ?? PORTAL_AGREEMENTS;
  const items: AgreementGateItem[] = agreements.map((a) => {
    const pool = (a.scope === "company" ? input.company : input.user).filter((s) => s.key === a.key && s.scope === a.scope);
    const current = pool.find((s) => s.version === a.version) ?? null;
    if (current) return { ...a, state: "signed", canSign: false, signature: current };
    if (a.scope === "company" && !input.isCompanySigner) return { ...a, state: "awaiting_company", canSign: false, signature: null };
    return { ...a, state: pool.length ? "updated" : "outstanding", canSign: true, signature: null };
  });
  const open = items.filter((i) => i.state !== "signed");
  return {
    complete: open.length === 0,
    canFinish: open.every((i) => i.canSign),
    isCompanySigner: input.isCompanySigner,
    items,
  };
}

/** Welcome video for one audience. `url` is null until Joe's recording is published. */
export interface WelcomeVideo {
  audience: AgreementScope;
  title: string;
  url: string | null;
  /** "embed" for a YouTube / Vimeo / Loom player URL, "file" for an mp4/webm. */
  kind: "embed" | "file" | null;
}

/**
 * Turn a configured link into something the gate can play: a YouTube (played
 * from youtube-nocookie.com), Vimeo or Loom share link becomes its player URL;
 * a same-origin path to an .mp4/.webm plays in a <video>. Anything else is
 * ignored, so the gate never frames an arbitrary site (and the CSP frame-src
 * in server/middleware/security.ts lists exactly these three players).
 */
export function welcomeVideoFrom(audience: AgreementScope, raw: string | undefined | null): WelcomeVideo {
  const title = audience === "company" ? "Welcome to Digerati Experts" : "Welcome to your Client Portal";
  const none: WelcomeVideo = { audience, title, url: null, kind: null };
  const value = (raw || "").trim();
  if (/^\/[\w\-./]+\.(mp4|webm|m4v)$/i.test(value) && !value.includes("..")) return { audience, title, url: value, kind: "file" };
  if (!/^https:\/\//i.test(value)) return none;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return none;
  }
  const host = url.hostname.replace(/^www\./, "");
  const segs = url.pathname.split("/").filter(Boolean);
  const id = (s: string | undefined | null) => (s && /^[\w-]{6,64}$/.test(s) ? s : null);
  let player: string | null = null;
  if (host === "youtu.be") player = id(segs[0]) && `https://www.youtube-nocookie.com/embed/${segs[0]}`;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = id(url.searchParams.get("v")) ?? (["embed", "shorts", "live"].includes(segs[0]) ? id(segs[1]) : null);
    player = v && `https://www.youtube-nocookie.com/embed/${v}`;
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const v = segs.find((s) => /^\d+$/.test(s));
    player = v ? `https://player.vimeo.com/video/${v}` : null;
  } else if (host === "loom.com") {
    const v = ["share", "embed"].includes(segs[0]) ? id(segs[1]) : null;
    player = v && `https://www.loom.com/embed/${v}`;
  }
  return player ? { audience, title, url: player, kind: "embed" } : none;
}

/** Gate enforcement: "enforce" sends people to the gate; "off" (default) only previews it. */
export type AgreementGateMode = "enforce" | "off";

export function agreementGateMode(raw: string | undefined | null): AgreementGateMode {
  return (raw || "").trim().toLowerCase() === "enforce" ? "enforce" : "off";
}
