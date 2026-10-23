# Lane D — System Status and shipment tracking (Wave 2)

Start only after Lane A is merged. Read `docs/plans/opencode/LANE-RULES.md`, `docs/lanes/registry.md`, the portal plan's **Phase 4** (items 4 and 7), and `SHIPPING_API_REFERENCE.md` at the repo root (shipping work may already exist; build on it).

**You own:** System Status, Ship Center, and order tracking on client orders.

## Build. One PR per feature.
1. **System Status**
   - DE staff post incidents and maintenance notices, for one client or for all clients, with start/end times and updates.
   - Clients see a status line on Home and a status page with current and recent notices.
   - Add live device health **only if** an RMM integration already exists in the codebase. Otherwise ship notices only and list the integration as follow-up work.
   - Never show invented health data.
2. **Ship Center**
   - DE staff create and update shipments: carrier, tracking number, status, linked order. Use the existing shipping API code where it fits.
   - Clients see tracking **inside "Order equipment"** on each order.
   - The separate Ship Center menu item stays DE-staff-only.

## Done means
- Real data only, with honest empty, loading and error states.
- Server-side role checks and a tenant isolation test.
- Set `featureReady: true` in your registry file only when everything passes.
