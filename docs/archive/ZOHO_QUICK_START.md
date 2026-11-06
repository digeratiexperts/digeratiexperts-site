# 🚀 Zoho Integration Quick Start

## What's Live Right Now ✅

Your homepage now features a **Zoho ASAP-like support widget** (bottom-right corner):
- 📝 **Support Tab** - Submit help tickets instantly
- 📚 **Knowledge Base Tab** - Browse help articles
- 🟢 **Status Tab** - Check system health

---

## 5-Minute Setup

### Step 1: Get Your Zoho Credentials
1. Go to https://api-console.zoho.com
2. Create OAuth App → Choose "Zoho Desk"
3. Set Redirect URI: `https://yourdomain.com/callback`
4. Copy **Client ID** & **Client Secret**

### Step 2: Add to .env
```bash
ZOHO_CLIENT_ID=your_id
ZOHO_CLIENT_SECRET=your_secret
ZOHO_REFRESH_TOKEN=get_from_oauth_flow
ZOHO_REGION=us

VITE_ZOHO_ACCOUNT_ID=your_account_id
VITE_ZOHO_PORTAL_ID=your_portal_id
```

### Step 3: Done!
Widget automatically embeds on homepage. Test by clicking the floating button in bottom-right.

---

## 🎯 API Endpoints Ready to Use

### Submit Support Ticket
```bash
POST /api/portal/zoho/ticket
{
  "email": "user@company.com",
  "subject": "Help needed",
  "description": "Describe your issue",
  "priority": "Medium"
}
```

### Get Support Tickets
```bash
GET /api/portal/zoho/tickets?email=user@company.com
```

### Check Zoho Status
```bash
GET /api/portal/admin/zoho/status
```

### View Active Flows
```bash
GET /api/portal/zoho/flows
```

---

## 🔗 Zoho Flow Integration Examples

**Flow 1: Auto-Respond to Tickets**
- Trigger: Ticket created in Zoho Desk
- Action: Send confirmation email to customer
- Action: Notify support team on Slack

**Flow 2: Smart Routing**
- Trigger: High-priority ticket received
- Action: Assign to senior support
- Action: Page on-call engineer

**Flow 3: Knowledge Base Suggestion**
- Trigger: Ticket created
- Action: Search KB for similar articles
- Action: Auto-reply with suggestions

Set these up in https://flow.zoho.com (no coding needed!)

---

## 📱 Widget Features

### Support Tab
- Email validation
- Subject & message fields
- Auto-creates ticket in Zoho Desk
- Instant confirmation

### Knowledge Base Tab
- Pre-populated articles:
  - Getting Started
  - Security Best Practices
  - Troubleshooting
  - Account Management
- Links to full KB (customizable)

### Status Tab
- Real-time system health
- Service status indicators
- Last update timestamp

---

## 🔐 Security Built-In

✅ All ticket submissions validated  
✅ Honeypot spam detection  
✅ Rate limiting on submissions  
✅ CSRF protection  
✅ Input sanitization  

---

## 📊 Database Tables

```
zoho_configurations     - API credentials
zoho_integration_logs   - Event tracking
zoho_ticket_sync        - Local ticket copy
zoho_flow_triggers      - Active workflows
```

---

## 🧪 Testing

### Test Locally
```bash
# Test widget loads
curl http://localhost:5000/ | grep -i "zoho"

# Test ticket submission
curl -X POST http://localhost:5000/api/portal/zoho/ticket \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "subject": "Test Ticket",
    "description": "Testing the widget"
  }'

# Check status
curl http://localhost:5000/api/portal/admin/zoho/status
```

### Test in Browser
1. Open your website
2. Click floating "?" button (bottom-right)
3. Fill out "Support" tab form
4. Click "Send Message"

---

## 🎨 Customize Widget

### Change Colors
Edit `/client/src/components/ZohoASAPWidget.tsx`:
```javascript
// Change from purple-blue gradient
"from-purple-600 to-blue-900"

// To your brand colors
"from-[#5034ff] to-[#030228]"  // Your Digerati colors!
```

### Add Custom CSS
```javascript
const customCSS = `
  .asap-widget {
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  }
`;

<ZohoASAPWidget customCSS={customCSS} />
```

### Pre-populate Fields
```javascript
<ZohoASAPWidget
  defaultEmail="support@digerati.com"
  defaultSubject="Website Inquiry"
/>
```

---

## 📈 Advanced Setup (Optional)

### Enable Zoho CRM Sync
- Add `ZOHO_CRM_ENABLED=true` to .env
- Sync customer data with CRM

### Enable Zoho Analytics
- Add analytics dashboard to admin portal
- Track ticket metrics & trends

### Webhook Signature Verification
- Verify Zoho Flow webhooks in production
- Add HMAC validation in `server/routes.ts`

---

## ❓ Troubleshooting

**Widget not showing?**
- Check browser console for errors
- Verify `VITE_ZOHO_ACCOUNT_ID` is set
- Clear cache and reload

**Tickets not submitting?**
- Verify Zoho API credentials
- Check rate limiting isn't blocking requests
- Look at console logs for errors

**Flows not triggering?**
- Test webhook at `/api/portal/zoho/flow-webhook`
- Verify flow is active in Zoho
- Check execution logs in Zoho portal

---

## 📚 Learn More

- **Zoho API Docs**: https://www.zoho.com/desk/api/
- **Zoho Flow**: https://www.zoho.com/flow/
- **ASAP Widget Guide**: https://www.zoho.com/desk/developers/asap/

---

## ✨ You're All Set!

Your Digerati portal now has professional Zoho Desk & Flow integration:

✅ ASAP widget on homepage  
✅ 5 API endpoints ready  
✅ Support ticket submission  
✅ Knowledge base integration  
✅ Zoho Flow webhook support  
✅ Security built-in  
✅ Production-ready  

**Next Step:** Add your Zoho credentials and launch! 🚀
