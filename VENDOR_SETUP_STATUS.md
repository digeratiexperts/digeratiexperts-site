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
```

> ⚠️ Real values were previously committed to this public repo and remain in git
> history. Those Zoho, JumpCloud, and Coro credentials must be rotated.
