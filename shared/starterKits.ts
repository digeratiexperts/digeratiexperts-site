import { starterShelf, catalogShelf, type ShelfEntry } from "./licenseShelf";
import type { ClientVaultKind } from "./clientVault";

/**
 * Starter kits by business type. Applying a kit to a company in the License
 * Patch Bay puts any missing parts in DE's pool, turns the kit's apps on for
 * the company and sends them to "Every machine". Licences are only listed as
 * recommended: how many seats a company needs is DE's call, so a kit never
 * allocates seats.
 *
 * Product choices are a starting point for DE to edit, not a compliance
 * determination. GCC High in particular: the client's tenant, data and admin
 * access must stay inside the GCC High boundary; this kit only records what
 * DE plans to license and install.
 */

export type StarterKit = {
  key: "regular" | "regulated" | "gcc-high";
  name: string;
  blurb: string;
  /** Shelf keys (shared/licenseShelf.ts). */
  apps: string[];
  licenses: string[];
  /** Documents the client's vault should hold for this business type (a checklist; nothing is uploaded for you). */
  vaultDocs: Array<{ kind: ClientVaultKind; title: string; hint: string }>;
  note?: string;
};

const MSA = { kind: "contract" as const, title: "Signed managed services agreement", hint: "The countersigned MSA and current SOW." };
const INSURANCE = { kind: "contract" as const, title: "Cyber insurance policy", hint: "Current-year declarations page and security requirements." };

export const STARTER_KITS: StarterKit[] = [
  {
    key: "regular",
    name: "Regular business",
    blurb: "Office, a browser, a PDF reader and zip on every machine; Business Premium and endpoint protection.",
    apps: [
      "starter:office365business",
      "starter:googlechrome",
      "starter:adobereader",
      "starter:7zip",
      "starter:agent-jumpcloud",
      "starter:agent-de",
      "starter:agent-coro",
    ],
    licenses: ["catalog:ms_m365_bp", "starter:coro", "starter:jumpcloud-platform"],
    vaultDocs: [MSA, INSURANCE],
  },
  {
    key: "regulated",
    name: "Regulated (HIPAA, legal, finance)",
    blurb: "The regular kit plus managed detection, identity protection and device management.",
    apps: [
      "starter:office365business",
      "starter:googlechrome",
      "starter:adobereader",
      "starter:7zip",
      "starter:agent-jumpcloud",
      "starter:agent-de",
      "starter:agent-coro",
      "starter:agent-blackpoint",
    ],
    licenses: [
      "catalog:ms_m365_e3",
      "starter:defender-business",
      "starter:entra-p1",
      "starter:intune-p1",
      "starter:blackpoint-mdr",
      "starter:coro",
      "starter:jumpcloud-platform",
    ],
    vaultDocs: [
      MSA,
      INSURANCE,
      { kind: "contract", title: "Business associate agreement or engagement terms", hint: "BAA for HIPAA clients; engagement or confidentiality terms for legal and finance." },
      { kind: "contract", title: "Written information security program", hint: "The client's WISP or security policy set." },
      { kind: "contract", title: "Incident response plan", hint: "Who to call, in what order, and the notification duties." },
    ],
    note: "Record the client's BAA or engagement terms in the vault before go-live.",
  },
  {
    key: "gcc-high",
    name: "GCC High (CUI / ITAR)",
    blurb: "GCC High licences and a minimal, reviewed app set. Data stays in the client's GCC High tenant.",
    apps: ["starter:adobereader", "starter:7zip", "starter:agent-de"],
    licenses: ["catalog:gcch_m365_g3", "catalog:gcch_m365_g5"],
    vaultDocs: [
      MSA,
      { kind: "contract", title: "CUI handling agreement", hint: "Scope and handling terms. The CUI itself never goes in DE's vault." },
      { kind: "contract", title: "System security plan reference", hint: "Where the SSP lives in the client's GCC High tenant, not the SSP itself." },
      { kind: "contract", title: "Tool review record (FedRAMP / CMMC)", hint: "One line per tool on these machines: authorization status and who reviewed it." },
    ],
    note: "Do not store CUI in DE's own vault. Every tool on these machines needs a FedRAMP / CMMC review first.",
  },
];

export function shelfEntry(key: string): ShelfEntry | undefined {
  return [...starterShelf(), ...catalogShelf()].find((e) => e.key === key);
}

export function starterKit(key: string): StarterKit | undefined {
  return STARTER_KITS.find((k) => k.key === key);
}
