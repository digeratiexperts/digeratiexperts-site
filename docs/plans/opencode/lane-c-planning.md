# Lane C — Questionnaires, IT Roadmap, Business Reviews (Wave 2)

Start only after Lane A is merged. Read `docs/plans/opencode/LANE-RULES.md`, `docs/lanes/registry.md`, and the portal plan's **Phase 4** (items 1–3 and the definition of "done").
Also read `docs/PORTAL-HUB-BIDIRECTIONAL-BRIEF.md`. If any of this data belongs in the Intelligence Hub (the operational control plane), follow that contract instead of creating a second source of truth, and note it in your log.

**You own:** DE Questionnaires, IT Roadmap, Business Reviews (client pages and DE staff management screens).

## Build, in this order. One PR per feature; push each and continue to the next.
1. **DE Questionnaires**
   - Build on the existing **Surveys** engine. Do not create a second form system.
   - DE staff assign a questionnaire to client users. Clients save drafts and submit. DE staff review responses.
   - Pending questionnaires show as tasks on the client's Home.
2. **IT Roadmap**
   - DE staff create per-client items: title, why it matters, priority, target quarter, estimated cost, status.
   - Client owners can comment and mark items approved. Other client roles can view only.
3. **Business Reviews**
   - DE staff create a review per client: meeting date, summary, decisions, linked roadmap items, attached PDF.
   - Clients see their review history.

## Done means
- Real data only, honest empty states, and loading and error states.
- Server-side role checks and a tenant isolation test.
- The DE staff side is fully usable.
- Remove the SAMPLE badge and set `featureReady: true` in your registry file **only** when every point above passes.
