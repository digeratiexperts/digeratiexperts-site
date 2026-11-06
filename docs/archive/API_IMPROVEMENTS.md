# Portal API Improvements & Cross-Service Communication

## Overview
The portal now features intelligent cross-service communication, AI-powered features, and comprehensive event tracking for seamless integration between all portal services.

## New Architecture Components

### 1. Event Bus (`server/eventBus.ts`)
- **Purpose**: Enables event-driven architecture for cross-service communication
- **Features**:
  - Pub/sub pattern for service events
  - Event history tracking (audit trail)
  - 1000-event history buffer
  
**Event Types**:
```typescript
TICKET_CREATED
TICKET_UPDATED
TICKET_RESOLVED
TICKET_ASSIGNED
PAYMENT_COMPLETED
PAYMENT_FAILED
INVOICE_PAID
SERVICE_ACTIVATED
SERVICE_CANCELLED
SHIPMENT_CREATED
SHIPMENT_DELIVERED
AI_SUGGESTION
AI_CLASSIFICATION
KNOWLEDGE_BASE_UPDATED
CHAT_MESSAGE_SENT
CHAT_SESSION_CREATED
```

### 2. AI Service (`server/aiService.ts`)
- **Ticket Classification**: Automatically categorizes tickets based on content
  - Security, Network, Access & Permissions, General Support, etc.
  - Assigns suggested priority (low/medium/high/critical)
  - Routes to appropriate department
  
- **Smart Suggestions**: Generates recommendations for tickets
  - Resolution suggestions from knowledge base
  - Escalation recommendations
  - Info resources
  - Action items
  
- **Ticket Analysis**: Predicts resolution time and recommends actions
  - Based on category and priority
  - Detects escalation needs
  - Suggests follow-ups

**Example: Ticket Classification**
```bash
POST /api/portal/tickets/classify
{
  "ticketId": "TICKET-123",
  "subject": "Network connectivity issues",
  "description": "Cannot connect to VPN"
}

Response:
{
  "classification": {
    "category": "Network",
    "confidence": 0.85,
    "suggestedPriority": "high",
    "suggestedDepartment": "infrastructure"
  },
  "suggestions": [...]
}
```

### 3. Cross-Service Handler (`server/crossServiceHandler.ts`)
- **Automatic Workflows**: Triggered by service events
  - Ticket created → Auto-classify and suggest
  - Payment completed → Mark invoice paid
  - Ticket resolved → Check for related services
  - Shipment delivered → Update service status
  - Chat message → Analyze sentiment

- **Smart Queries**: Complex multi-service queries
  - `getClientFullProfile()`: All services, tickets, invoices, shipments
  - `getPendingTicketsWithExpiringServices()`: Find blocking issues
  - `getUnpaidInvoicesWithOpenTickets()`: Identify payment blockers
  - `getSmartRecommendations()`: AI-driven insights for customer

### 4. New Database Tables

#### `portal_ticket_ai_classifications`
Stores AI-determined ticket metadata
```sql
- ticketId (FK to portal_tickets)
- category (string)
- suggestedPriority (string)
- suggestedDepartment (string)
- confidence (decimal)
- isApplied (boolean)
```

#### `portal_ai_suggestions`
Stores AI-generated recommendations
```sql
- ticketId (FK to portal_tickets)
- suggestionType (resolution|escalation|info|action)
- content (text)
- source (knowledge_base|security_policy|disaster_recovery)
- confidence (decimal)
- wasUseful (boolean)
```

#### `portal_shipments`
Tracks all shipments for Ship Center
```sql
- clientId (FK)
- shipmentNumber (unique)
- status (pending|processing|shipped|in_transit|delivered)
- itemCount
- trackingNumber
- estimatedDelivery, deliveredAt
```

#### `portal_procurement_products`
Products from internal and partner sources
```sql
- name, description, category
- price (decimal)
- source (internal|griffin-it|sherweb|pax8|climbcs)
- externalUrl (for partner products)
```

## New API Endpoints

### AI & Classification
```
POST /api/portal/tickets/classify
  - Classify a ticket using AI
  - Input: ticketId, subject, description
  - Output: classification, suggestions

GET /api/portal/tickets/:id/recommendations
  - Get AI recommendations for a ticket
  - Output: ticketId, recommendations[]
```

### Cross-Service Queries
```
GET /api/portal/clients/:clientId/profile
  - Get full cross-service client profile
  - Returns: services, tickets, invoices, shipments

GET /api/portal/clients/:clientId/smart-recommendations
  - Get AI-driven smart recommendations
  - Examples: escalations, renewals, payment reminders, upgrade suggestions
```

### Debugging & Monitoring
```
GET /api/debug/events?limit=100&type=TICKET_CREATED
  - View event bus history
  - Query parameters:
    - limit: number of events (default 100)
    - type: filter by event type (optional)
  - Output: count, events[]

GET /api/debug/db-health
  - Check database health and stats
  - Output: status, table estimates, connection info
```

## How Services Communicate

### Example: Ticket Creation Workflow

1. **User creates ticket** → Portal Tickets service
2. **Event emitted**: `TICKET_CREATED` event with ticket data
3. **Event Bus** propagates event to all listeners
4. **AI Service** receives event:
   - Classifies ticket content
   - Generates suggestions
   - Stores in AI tables
5. **Cross-Service Handler** receives event:
   - Stores classification
   - May trigger follow-up actions
   - Event recorded in history

### Example: Payment Completion Workflow

1. **Stripe webhook** → Payment service
2. **Event emitted**: `PAYMENT_COMPLETED` with invoice data
3. **Event Bus** propagates event
4. **Cross-Service Handler** receives event:
   - Marks invoice as paid
   - Updates dashboard
   - Sends confirmation email
5. **Event** stored in history for audit trail

## Database Improvements

### Optimization Features
- **Cross-service linking**: Foreign keys enable complex queries
- **AI metadata**: Classification and suggestion tables enable intelligent features
- **Event tracking**: Full audit trail of all service interactions
- **Shipment tracking**: Real-time shipment status
- **Product sourcing**: Unified procurement from internal and partners

### Index Recommendations (for production)
```sql
CREATE INDEX idx_portal_tickets_status ON portal_tickets(status);
CREATE INDEX idx_portal_tickets_priority ON portal_tickets(priority);
CREATE INDEX idx_portal_invoices_status ON portal_invoices(status);
CREATE INDEX idx_portal_invoices_client_id ON portal_invoices(clientId);
CREATE INDEX idx_portal_shipments_status ON portal_shipments(status);
CREATE INDEX idx_portal_chat_messages_ticket_id ON portal_chat_messages(ticketId);
CREATE INDEX idx_portal_ai_classifications_ticket_id ON portal_ticket_ai_classifications(ticketId);
```

## Testing the Integration

### Test AI Classification
```bash
curl -X POST http://localhost:5000/api/portal/tickets/classify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "subject": "Cannot connect to VPN",
    "description": "Network is down, employee cannot work"
  }'
```

### Test Smart Recommendations
```bash
curl http://localhost:5000/api/portal/clients/CLIENT-ID/smart-recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Monitor Event Bus
```bash
curl "http://localhost:5000/api/debug/events?limit=50&type=TICKET_CREATED" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Database Health
```bash
curl http://localhost:5000/api/debug/db-health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Considerations

- **Event History**: Limited to 1000 events in memory (configured in eventBus.ts)
- **AI Classification**: Heuristic-based (no LLM calls) for fast response
- **Database Queries**: Ready for indexing optimization in production
- **Cross-Service**: Event-driven reduces coupling, improves scalability

## Future Enhancements

1. **LLM Integration**: Replace heuristics with actual AI models (GPT-4, Claude)
2. **ML Training**: Train models on historical ticket data
3. **Predictive Analytics**: Forecast resolution times, churn prediction
4. **Sentiment Analysis**: Analyze customer satisfaction from chats
5. **Automated Actions**: Self-healing tickets, auto-escalations
6. **Advanced Queries**: Machine learning for smart recommendations

## Migration from Previous System

All existing portal functionality remains intact:
- Tickets, invoices, payments, chat, services, shipments, procurement
- New features are additive - no breaking changes
- Event bus operates silently unless subscribed
- AI features are opt-in via API calls

## Deployment Notes

- Event history is in-memory (lost on restart - implement persistent storage for production)
- Heuristic AI is local (integrate external LLM service for advanced features)
- Database must have Neon/PostgreSQL enabled for new tables
- All new tables auto-created via migrations
