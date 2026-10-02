# 🔌 Vendor Integration Setup Status

> **Scope:** this file tracks technical/API integration status, not whether a vendor is approved for DE service delivery. Vendor lifecycle and commercial authority live in Intelligence Hub / Vendor Intelligence.

## ✅ Connected & Active (3)

### Zoho (Existing)
- **Status**: ✅ Connected
- **Environment Variables**: 
  - ZOHO_CLIENT_ID
  - ZOHO_CLIENT_SECRET
- **Features**: Ticket management, CRM sync, Flow automation
- **Endpoints**: Already integrated in portal

### JumpCloud
- **Status**: ✅ Connected  
- **Environment Variables**: JUMPCLOUD_API_KEY
- **Features**: Device management, inventory, policy deployment
- **Setup**: `server/services/vendor-integration-scaffold.ts` → JumpCloudIntegration class
- **Next**: Build admin endpoints for device sync

### Coro.net
- **Status**: ✅ Existing integration scaffold / credentials recorded
- **Environment Variables**: CORO_CLIENT_ID, CORO_CLIENT_SECRET
- **Features**: Security monitoring, threat alerts, compliance
- **Setup**: `server/services/vendor-integration-scaffold.ts` → CoroIntegration class
- **Note**: Integration presence does not establish current DE vendor-selection status; use Hub Vendor Intelligence for that decision.

---

## ⏳ Pending Credentials / API Enablement

### Procurement Partners
- [ ] **Griffin IT** - Awaiting API Key/OAuth
- [ ] **Sherweb** - Awaiting API Key/OAuth
- [ ] **Pax8** - Awaiting API Key/OAuth
- [ ] **ClimbCS** - Awaiting API Key/OAuth

### Security & Device Management
- [ ] **BlackPoint** - Awaiting Client ID/Secret or API Key

### Sales Intelligence
- [ ] **Seamless.ai** - Awaiting API Key

---

## 🔮 Planned / Future Integrations

- [ ] **Timus Networks** - **Selected DE Secure Access & Zero Trust platform**; partner/API details and DE commercial validation pending. JumpCloud is the preferred identity integration where applicable.
- [ ] **Cytracom** - UCaaS/voice integration only; keep separate from ControlOne SASE.
- [ ] **Uplevel Systems** - Awaiting credentials & API details
- [ ] **Galactic Advisors** - Awaiting credentials & API details
- [ ] **Atakama** - Awaiting credentials & API details

### Legacy / migration only
- **Cytracom ControlOne** - DE is migrating the SASE/ZTNA role to Timus. Do not build new standard ControlOne SASE integrations. Preserve only what is needed to operate and migrate existing deployments.

---

## Portal tools waiting on vendors (decided 2026-10-02)

These answers stand in for the portal questions that were still open. The pages stay in the nav. Build the real connection when the vendor sends API access and the facts below. Until then the screens are samples: do not treat their devices, call lists, or tracking numbers as live.

### VPN Access (`/portal/vpn`) — Timus
Timus is the secure-access platform. Ask Timus for partner API docs, the auth method, a tenant id, a sandbox, and which fields a client may see (profile status, device name, last connected). JumpCloud stays the identity side. Tailscale, WireGuard, OpenVPN, Perimeter 81, and Twingate are not this page.

### Cytracom Phone (`/portal/cytracom`) — Cytracom voice API
Use Cytracom’s UCaaS API for this page. Ask them for the base URL, auth method, a sandbox tenant, the extension list, and whether call history and voicemail are in the API. When they send a key, store it as an environment variable taken from their docs. Do not commit the value. ControlOne is the migration item above, not this page.

### Ship Center (`/portal/ship-center`) — staff-entered tracking
DE staff enter tracking numbers on a real shipment. ShipStation, EasyPost, and Shippo are not selected. Live rates, labels, and carrier tracking wait on USPS, FedEx, and UPS API keys and account numbers (`SHIPPING_SETUP.md`). Ask those carriers for that access before any live call.

### Test login
Set `PORTAL_QA_EMAIL` and `PORTAL_QA_PASSWORD` in the portal process environment (host environment settings). The account is for QA. It is not a client company. The values stay out of git.

### Exit popup
The client keeps the assessment findings either way, including when they do not engage DE. The next edit of `client/src/components/ExitIntentPopup.tsx` should say that on the third fact. Do not add a delivery date or a score. Recorded in `docs/CLAIMS-REGISTER.md`.

---

## 🚀 Next Steps

1. **Complete Timus adoption gates**
   - Complete partner onboarding and record real DE pricing/terms in Hub
   - Build and validate the DE Timus tenant
   - Configure/test JumpCloud SAML
   - Validate SASE/ZTNA/SWG/FWaaS, posture, private access, logging, rollback, and support procedures
   - Keep `quoteable=false` until commercial and pilot gates pass

2. **Maintain existing connected integrations intentionally**
   - Continue JumpCloud device/API work where required
   - Treat legacy integration scaffolds as implementation state, not automatic vendor approval

3. **Migrate ControlOne safely**
   - Inventory each existing ControlOne deployment
   - Move secure-access functions to Timus after pilot acceptance
   - Assign physical routing/LAN/WAN dependencies to the Managed Network platform before cutover
   - Keep Cytracom voice/UCaaS independent

---

## 📝 Environment Variables Set
```
ZOHO_CLIENT_ID=<set in environment — do not commit>
ZOHO_CLIENT_SECRET=<set in environment — do not commit>
JUMPCLOUD_API_KEY=<set in environment — do not commit>
CORO_CLIENT_ID=<set in environment — do not commit>
CORO_CLIENT_SECRET=<set in environment — do not commit>
PORTAL_QA_EMAIL=<set in environment — do not commit>
PORTAL_QA_PASSWORD=<set in environment — do not commit>
```

> ⚠️ Real values were previously committed to this public repo and remain in git
> history. Those Zoho, JumpCloud, and Coro credentials must be rotated.
