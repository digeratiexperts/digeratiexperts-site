# 🔗 Zoho One, Flow & ASAP Integration

## Overview

Your Digerati Experts portal now integrates with **Zoho One**, **Zoho Flow**, and **Zoho Desk/ASAP** for comprehensive support and workflow automation.

### What's Integrated

✅ **Zoho ASAP Widget** - Embedded help widget on homepage  
✅ **Zoho Desk Integration** - Create and manage support tickets  
✅ **Zoho Flow Support** - Trigger workflows from portal events  
✅ **Zoho One Compatibility** - Works with entire Zoho ecosystem  

---

## 🚀 Features Implemented

### 1. ASAP-Like Support Widget
- **Floating widget** on homepage (bottom-right)
- **Support tab** - Submit help tickets
- **Knowledge Base tab** - Browse help articles
- **System Status tab** - Check service status
- **Zoho Desk integration** - Tickets sync with Zoho Desk

**Location:** `/client/src/components/ZohoASAPWidget.tsx`

### 2. Zoho Service Class
- Complete OAuth 2.0 authentication
- Ticket creation, retrieval, updates
- Comment management
- Flow execution support

**Location:** `/server/services/zoho.ts`

### 3. Database Schema
New tables for Zoho integration:
- `zoho_configurations` - API credentials & settings
- `zoho_integration_logs` - Sync/event logging
- `zoho_ticket_sync` - Local ticket copies
- `zoho_flow_triggers` - Active workflows

---

## 🔑 Environment Variables

Add these to your `.env` file for Zoho configuration:

```bash
# Zoho ASAP Widget
VITE_ZOHO_ACCOUNT_ID=your_zoho_account_id
VITE_ZOHO_PORTAL_ID=your_zoho_portal_id

# Zoho API Configuration (backend)
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_REGION=us  # us, eu, in, com
```

---

## 📝 Setup Instructions

### Step 1: Get Zoho Credentials

1. **Go to Zoho Developer Console**
   - Visit: https://api-console.zoho.com

2. **Create OAuth Application**
   - App Name: "Digerati Experts Portal"
   - Authorized Redirect URI: `https://yourdomain.com/api/auth/zoho/callback`

3. **Get Credentials**
   - Client ID
   - Client Secret
   - Scope: `Desk.tickets.CREATE Desk.tickets.READ Desk.tickets.UPDATE`

4. **Generate Refresh Token**
   - Use OAuth flow to get initial auth code
   - Exchange for refresh token

### Step 2: Configure Your Portal

```bash
# 1. Add environment variables
echo "ZOHO_CLIENT_ID=your_id" >> .env
echo "ZOHO_CLIENT_SECRET=your_secret" >> .env
echo "ZOHO_REFRESH_TOKEN=your_token" >> .env
echo "ZOHO_REGION=us" >> .env

# 2. Configure widget in your portal settings
# Add Zoho Account ID and Portal ID
```

### Step 3: Set Up Zoho Desk

1. **Enable ASAP Widget in Zoho Desk**
   - Settings → Channels → ASAP
   - Copy your Account ID & Portal ID

2. **Configure Support Email**
   - Settings → Email Configurations
   - Your support email address

---

## 🎯 API Endpoints

### Submit Support Ticket
```bash
POST /api/portal/zoho/ticket
Content-Type: application/json

{
  "email": "user@company.com",
  "subject": "Issue with...",
  "description": "Detailed problem...",
  "priority": "Medium"  # Low, Medium, High, Urgent
}

Response:
{
  "success": true,
  "ticketId": "1234567890",
  "message": "Ticket created successfully"
}
```

### Get User Tickets
```bash
GET /api/portal/zoho/tickets?email=user@company.com
Authorization: Bearer token

Response:
{
  "tickets": [
    {
      "id": "1234567890",
      "subject": "Support Request",
      "status": "Open",
      "priority": "Medium",
      "createdTime": "2025-11-23T10:00:00Z"
    }
  ]
}
```

### Create Zoho Flow Webhook
```bash
POST /api/portal/zoho/flow-webhook

Triggered by Zoho Flow when:
- Ticket created
- Ticket updated
- Customer submitted form
- Response needed
```

---

## 🔄 Zoho Flow Integration

### Common Workflows

**1. New Ticket Notification**
- Trigger: Ticket created in Zoho Desk
- Action: Send Slack notification to support channel
- Action: Create task in project management tool

**2. Auto-Response Email**
- Trigger: Customer submits ticket
- Action: Send confirmation email
- Action: Assign to support team

**3. Escalation Workflow**
- Trigger: Ticket > 2 days old & priority = Urgent
- Action: Notify senior support
- Action: Update internal system

**4. Knowledge Base Suggestion**
- Trigger: Ticket created
- Action: Search KB for similar articles
- Action: Reply with suggestions (if found)

### Setting Up a Flow

1. **Go to Zoho Flow** (flow.zoho.com)
2. **Create New Flow**
   - Trigger: Zoho Desk → New Ticket
   - Action 1: Webhook → Send to `/api/portal/zoho/flow-webhook`
   - Action 2: Slack → Send notification

3. **Activate Flow**
   - Test trigger
   - Verify webhook receives data
   - Go live

---

## 🛠️ Troubleshooting

### Widget Not Showing?
- Check browser console for errors
- Verify `VITE_ZOHO_ACCOUNT_ID` is set
- Ensure Zoho ASAP is enabled in Zoho Desk

### Tickets Not Creating?
```bash
# Check API credentials
curl -X POST https://www.zoho.com/desk/api/v1/tickets \
  -H "Authorization: Zoho-oauthtoken YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subject":"Test"}'

# If 401: Token expired, refresh it
# If 403: Missing Desk scope
# If 500: Zoho API issue
```

### OAuth Token Expired?
- Token auto-refreshes every 60 minutes
- Manual refresh: `/api/portal/admin/zoho/refresh-token`

---

## 📊 Monitoring

### Check Integration Status
```bash
GET /api/portal/admin/zoho/status
```

### View Sync Logs
```bash
GET /api/portal/admin/zoho/logs?limit=50
```

### Test Zoho Connection
```bash
POST /api/portal/admin/zoho/test-connection
```

---

## 🔐 Security

✅ **OAuth 2.0** - Secure authentication  
✅ **Token Encryption** - Stored securely in database  
✅ **Rate Limiting** - API call throttling  
✅ **Input Validation** - All data sanitized  
✅ **HTTPS Only** - Encrypted in transit  

---

## 📈 Next Steps (Optional)

1. **Enable Zoho CRM** - Sync customer data
2. **Enable Zoho Analytics** - Dashboard insights
3. **Custom Zoho Fields** - Map to portal fields
4. **Advanced Flows** - Multi-step automation
5. **Zoho Books Integration** - Invoice sync

---

## 📚 Resources

- **Zoho Developer Portal**: https://www.zoho.com/developer/
- **Zoho Desk API**: https://www.zoho.com/desk/api/
- **Zoho Flow Docs**: https://help.zoho.com/portal/en/kb/flow/
- **ASAP Widget Guide**: https://www.zoho.com/desk/developers/asap/

---

## ✅ Status

🟢 **Zoho Integration Ready**

- ASAP Widget: Active on homepage
- Zoho Desk: Ready for connection
- Zoho Flow: Webhook endpoints ready
- Zoho One: Full ecosystem compatible

Connect your Zoho credentials and start sending/receiving support tickets!
