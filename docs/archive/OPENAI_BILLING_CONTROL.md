# 💰 OpenAI Integration Billing Control

## Overview

You now have **complete control over OpenAI API usage** through admin endpoints. Toggle AI features on/off at any time to manage billing.

---

## 🎛️ Quick Control

### Check Status
```bash
curl -X GET http://localhost:5000/api/portal/admin/openai/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "status": {
    "enabled": true,
    "apiKey": "***configured***",
    "baseUrl": "default (api.openai.com)"
  },
  "message": "OpenAI integration is enabled - API calls will be made and billed"
}
```

### Toggle (Enable/Disable)
```bash
curl -X POST http://localhost:5000/api/portal/admin/openai/toggle \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Enable OpenAI
```bash
curl -X POST http://localhost:5000/api/portal/admin/openai/enable \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Disable OpenAI
```bash
curl -X POST http://localhost:5000/api/portal/admin/openai/disable \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

---

## ⚙️ Environment Configuration

### Default Behavior
- **By default**: OpenAI is **ENABLED** (AI features active)
- **API calls**: Will be made and billed to your Replit credits

### Disable via Environment Variable

To disable OpenAI by default when the app starts:

```bash
# Set in your .env or environment settings
ENABLE_OPENAI_INTEGRATION=false
```

**Valid values:**
- `false` or `0` = Disabled on startup
- `true` or `1` = Enabled on startup
- (not set) = Enabled on startup (default)

---

## 🔌 Integration Points

The OpenAI configuration manager is used by these features:

1. **Hybrid AI/Human Chat** (when implemented)
   - AI responses on/off
   - Cost control per feature

2. **Ticket Classification** (when implemented)
   - Auto-categorize support tickets
   - Suggest resolutions

3. **Smart Recommendations** (when implemented)
   - Suggest products/services
   - Lead qualification

### Example: Using OpenAI Guard

When developers build AI features, they use the guard function:

```typescript
import { withOpenAIGuard } from "@server/services/openai-config";

// Make OpenAI call with automatic billing control
const result = await withOpenAIGuard(async () => {
  return await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Classify this ticket..." }],
  });
});

// If OpenAI disabled: result = null
// If OpenAI enabled: result = API response
if (!result) {
  console.log("OpenAI disabled - skipped API call");
}
```

---

## 📊 Billing Scenarios

### Scenario 1: Control During Development
```
1. Disable OpenAI during development
   POST /api/portal/admin/openai/disable

2. Implement features without incurring costs
   
3. Enable when ready for testing
   POST /api/portal/admin/openai/enable
```

### Scenario 2: Disable During Low Activity
```
1. Check status
   GET /api/portal/admin/openai/status

2. If few users active, disable to save credits
   POST /api/portal/admin/openai/disable

3. Re-enable during business hours
   POST /api/portal/admin/openai/enable
```

### Scenario 3: Budget Cap
```
1. Set up budget alert with Replit
2. When approaching limit, disable OpenAI
   POST /api/portal/admin/openai/disable
3. Re-enable next billing cycle
   POST /api/portal/admin/openai/enable
```

---

## 📋 API Reference

### GET /api/portal/admin/openai/status

**Purpose:** Check if OpenAI is enabled and see configuration

**Auth:** Admin only

**Response:**
```json
{
  "status": {
    "enabled": true,
    "apiKey": "***configured***",
    "baseUrl": "default (api.openai.com)"
  },
  "message": "OpenAI integration is enabled - API calls will be made and billed"
}
```

---

### POST /api/portal/admin/openai/toggle

**Purpose:** Toggle OpenAI on/off (switches current state)

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "enabled": false,
  "message": "✅ OpenAI integration DISABLED - no API calls will be made",
  "status": {
    "enabled": false,
    "apiKey": "***configured***",
    "baseUrl": "default (api.openai.com)"
  }
}
```

---

### POST /api/portal/admin/openai/enable

**Purpose:** Explicitly enable OpenAI

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "wasAlreadyEnabled": false,
  "message": "✅ OpenAI integration ENABLED - API calls will now be made and billed",
  "status": {
    "enabled": true,
    "apiKey": "***configured***",
    "baseUrl": "default (api.openai.com)"
  }
}
```

---

### POST /api/portal/admin/openai/disable

**Purpose:** Explicitly disable OpenAI

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "enabled": false,
  "wasAlreadyDisabled": false,
  "message": "✅ OpenAI integration DISABLED - no further API calls will be made",
  "status": {
    "enabled": false,
    "apiKey": "***configured***",
    "baseUrl": "default (api.openai.com)"
  }
}
```

---

## 🔐 Security & Auditing

### Who Can Control OpenAI?
- **Admin-only endpoints** - Only admins can toggle
- **Authentication required** - Must have valid session
- **Logged events** - All changes logged to security events

### Audit Trail
All OpenAI toggles are logged with:
- Admin username who made the change
- Timestamp
- New state (enabled/disabled)
- Access via `/api/security/events` endpoint

### Example Log Entry
```json
{
  "type": "OPENAI_TOGGLED",
  "timestamp": "2025-11-23T20:00:00Z",
  "user": "admin@digerati.com",
  "details": {
    "enabled": false,
    "user": "admin@digerati.com"
  }
}
```

---

## 🚀 Best Practices

1. **Check Status First**
   ```bash
   # Always verify current state before toggling
   curl -X GET /api/portal/admin/openai/status
   ```

2. **Disable During Development**
   ```bash
   # Don't waste credits on dev/testing
   curl -X POST /api/portal/admin/openai/disable
   ```

3. **Monitor Billing**
   ```bash
   # Enable only when needed
   # Check Replit credits regularly
   ```

4. **Communicate Changes**
   - Notify team when toggling
   - Document reason for change in logs
   - Set up alerts for budget

5. **Gradual Rollout**
   - Enable for small group first
   - Monitor costs
   - Expand gradually

---

## 🔧 Implementation for Developers

### When Building AI Features

**Always use the guard function:**

```typescript
import { openaiConfig, withOpenAIGuard } from "@server/services/openai-config";

// Option 1: Check before making call
if (openaiConfig.isEnabled()) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...]
  });
}

// Option 2: Use guard function (recommended)
const response = await withOpenAIGuard(async () => {
  return await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...]
  });
});

if (!response) {
  console.log("OpenAI disabled - returning cached/fallback response");
}
```

---

## ❓ FAQ

### Q: What happens if OpenAI is disabled mid-request?
**A:** The request returns `null`. The application should have fallback logic.

### Q: Can users disable OpenAI?
**A:** No, only admins can toggle. Users cannot affect billing.

### Q: Does disabling stop in-progress requests?
**A:** New requests are blocked, but running requests complete.

### Q: How do I re-enable after disabling?
**A:** `POST /api/portal/admin/openai/enable` or toggle via `POST /api/portal/admin/openai/toggle`

### Q: Is there cost for checking if OpenAI is enabled?
**A:** No, checking status is free. Only actual API calls to OpenAI incur charges.

### Q: How often should I check the status?
**A:** As needed. No performance impact from status checks.

---

## 🎯 Summary

✅ **Full billing control** - Enable/disable anytime  
✅ **Admin-only** - Security built-in  
✅ **Audited** - All changes logged  
✅ **Developer-friendly** - Guard functions protect code  
✅ **Environment configurable** - Control on startup  

**Status: Ready to use** 🚀
