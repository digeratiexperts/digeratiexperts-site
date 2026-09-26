# DE naming canon — network services and communications

**Written in stone by Joe on 2026-09-03.** In DE usage, "write it in stone"
means a decision is canonical, durable, and part of DE operating standards,
not a temporary conversational preference. These names apply across the
website, the store, TechSales and the Hub, proposals, SOPs, service models,
internal documentation, architecture work and future implementation, unless
Joe explicitly changes them.

Do not casually rename these services, fall back to vague legacy labels such
as "Network & SASE", or invent competing terminology in UI or documentation.
Where existing production or internal content conflicts with these names,
update it carefully and consistently without changing unrelated working
content.

## Network services (canonical structure)

| Service | Definition |
| --- | --- |
| **Cloud Edge / SASE** | Cloud-delivered secure access, zero-trust connectivity, secure access for users, devices and apps, and related SASE functions. |
| **Managed Physical Site Network** | DE-managed site networking: gateway/firewall, switching, Wi-Fi, VLANs, segmentation, IDS/IPS, monitoring, configuration and lifecycle management. |
| **Hybrid / Multi-Site** | Physical-site networking combined with SASE/zero-trust, site-to-site connectivity, SD-WAN/VPN, segmentation and internet failover across one or more locations. |
| **Co-Managed Network** | DE owns an explicitly defined networking/security scope while the customer's IT team or another provider owns the remaining responsibilities. |

### Capability labels used beneath those services, where applicable

- Secure Edge
- SASE / Zero Trust
- Site-to-Site
- SD-WAN / VPN
- Wireless & Switching
- Segmentation / NAC
- Internet & Failover
- Monitoring & Alerting

## Communications (existing canonical naming, preserved)

| Name | Definition |
| --- | --- |
| **Threadline** | The customer-facing intelligent communications continuity service family. |
| **Threadline Migration** | Threadline service. |
| **Threadline Inbox** | Threadline service. |
| **Threadline Continuity** | Threadline service. |
| **Threadline Recovery** | Threadline service. |
| **Switchboard** | The provider-agnostic orchestration/control engine powering Threadline across Google, Microsoft and Zoho, including personal and business environments. |

## How this canon relates to the service model

`docs/DE-SERVICE-MODEL-2026.md` (PR #185) names the 12 public capability
lanes and the eight cybersecurity blocks. The network services above are the
canonical *service names* inside the network lane; "Network" remains the name
of cybersecurity block 05. Neither list is renamed by this document; the
service names are what the store, proposals and pages call the offers.

## Conflict inventory on `main` @ `80ce2f4` (to be swept; nothing renamed yet)

Found by search on 2026-09-03. Each line is a legacy or competing label that
the sweep must map to a canonical name, in context, without touching
unrelated content. Version snapshots under `client/src/pages/versions/` and
the review lab under `public/scrollcraft/` are frozen records and are not
swept.

| File | Legacy label(s) | Likely canonical mapping |
| --- | --- | --- |
| `client/src/data/serviceCatalog.ts` | "Managed Network Services", short "Managed Network" | Managed Physical Site Network (with the capability labels beneath) |
| `client/src/data/curatedSolutions.ts` | "DE Managed Network", "DE Co-Managed Network Operations" | Managed Physical Site Network; Co-Managed Network |
| `client/src/data/storeProducts.ts` | "Managed Network - Core", "- Advanced", "- Multi-Site Add-on"; category label `networking_managed: "Managed Network"` | Managed Physical Site Network tiers; the add-on maps to Hybrid / Multi-Site; the category label to the canonical service family |
| `shared/schema.ts` | comment "C) Managed Network" on `networking_managed` | comment only; key unchanged |
| `client/src/pages/solutions/ProActiveOfficeEcosystemPage.tsx`, `OfficePage.tsx` | "Managed Network & Connectivity" | Managed Physical Site Network |
| `client/src/pages/solutions/SolutionsIndex.tsx` | "Managed Network Security" | Managed Physical Site Network, or Cloud Edge / SASE if the card describes secure access |
| `client/src/components/ServiceCapabilityMatrix.tsx`, `client/src/pages/NetworkPlannerOfficial.tsx`, `EcosystemMatrixOfficial.tsx`, `Ecosystem.tsx`, `EcosystemPricing.tsx`, `client/src/pages/routes/servicePages.tsx` | matches on SASE / SD-WAN / multi-site vocabulary; to be read line by line | capability labels (SASE / Zero Trust, SD-WAN / VPN, Site-to-Site, …) |
| `client/src/data/resourceRegistry.ts`, `vendorLogos.ts`, `client/src/pages/resources/Videos.tsx`, `client/src/pages/about/TwentyOneQuestions.tsx`, `server/portalLearningCatalog.ts` | matches on the same vocabulary; to be read | as above |
| `docs/SUBJECT-PAGE-CONTENT-BRIEF.md`, `docs/MESHY-ASSET-BACKLOG.md`, `docs/MESHY-MCP.md`, `docs/VISUAL-ASSET-INVENTORY.md`, `docs/MESHY-BATCH-01.md` | "Managed Network" in briefs and asset inventories | Managed Physical Site Network |
| `attached_assets/*.txt` (pasted source material) | historical pastes | not swept; source material, not content |

Threadline and Switchboard: the search found the vocabulary in the files
above; the sweep must confirm every occurrence uses exactly the six canonical
names and never a variant.

## The sweep, when it runs

1. Read each file above in context; map each label to one canonical name.
2. Change labels and copy only; never keys, ids, routes, prices, or
   inclusions (the store's `networking_managed` key and `proactiveCoverage`
   data stay as they are).
3. One PR per surface (website copy and data; store products; docs), each
   with before/after evidence and the smoke gate green.
4. TechSales and the Hub live in other repositories (`digeratiexperts/TechSales`,
   `digeratiexperts/Intelligence-Hub`); their sweeps are separate lanes.
