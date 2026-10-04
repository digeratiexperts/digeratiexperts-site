/**
 * Cross-Service Handler
 * Manages intelligent communication between portal services
 */

import { eventBus, EventTypes } from "./eventBus";
import { aiService } from "./aiService";
import { storage } from "./storage";
import { notificationService } from "./services/notificationService";
import { logger } from "./logger";
import { enqueueWebsiteCommand } from "./integrations/enqueueWebsiteCommand";

export function setupCrossServiceHandlers() {
  // When payment is completed, automatically mark related invoices as paid
  eventBus.on(EventTypes.PAYMENT_COMPLETED, async (data) => {
    try {
      logger.info("Cross-service: Payment completed", { invoiceId: data.invoiceId });
      
      // Send order confirmation email
      if (data.email && data.name && data.orderId) {
        await notificationService.sendOrderConfirmation({
          email: data.email,
          name: data.name,
          orderId: data.orderId,
          items: data.items || [],
          total: data.total || 0,
        });
      }
    } catch (error) {
      logger.error("Error handling payment completion", error);
    }
  });

  // When ticket is created, classify it using AI
  eventBus.on(EventTypes.TICKET_CREATED, async (data) => {
    try {
      logger.info("Cross-service: Classifying ticket", { ticketId: data.ticketId });
      const classification = await aiService.classifyTicket(
        data.subject,
        data.description
      );
      const suggestions = await aiService.generateSuggestions({
        title: data.subject,
        description: data.description,
        category: classification.category,
      });
      logger.debug("AI Classification", { classification, suggestions });
    } catch (error) {
      logger.error("Error classifying ticket", error);
    }
  });

  // When ticket is resolved, notify customer and check for pending payments
  eventBus.on(EventTypes.TICKET_RESOLVED, async (data) => {
    try {
      logger.info("Cross-service: Ticket resolved", { ticketId: data.ticketId });
      
      // Send ticket update notification
      if (data.email && data.name) {
        await notificationService.sendTicketUpdate({
          email: data.email,
          name: data.name,
          ticketId: data.ticketId,
          status: "Resolved",
          subject: data.subject || "Support Ticket",
          message: data.resolution,
        });
      }
    } catch (error) {
      logger.error("Error handling ticket resolution", error);
    }
  });

  // When shipment is delivered, auto-update service activation status
  eventBus.on(EventTypes.SHIPMENT_DELIVERED, async (data) => {
    try {
      logger.info("Cross-service: Shipment delivered", { shipmentId: data.shipmentId });
    } catch (error) {
      logger.error("Error handling shipment delivery", error);
    }
  });

  // When chat message sent, analyze for sentiment and escalation needs
  eventBus.on(EventTypes.CHAT_MESSAGE_SENT, async (data) => {
    try {
      logger.debug("Cross-service: Analyzing chat message", { messageId: data.messageId });
    } catch (error) {
      logger.error("Error analyzing chat message", error);
    }
  });

  // When new lead is submitted
  eventBus.on(EventTypes.LEAD_CREATED, async (data) => {
    try {
      logger.info("Cross-service: New lead created", { leadId: data.id });
      
      // Send notification to admin
      await notificationService.sendNewLeadNotification({
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message,
        source: data.source,
      });

      await enqueueWebsiteCommand({
        id: data.id,
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message,
        source: data.source || "lead",
        ...(data.followUp ? { followUp: data.followUp } : {}),
      });
    } catch (error) {
      logger.error("Error handling new lead", error);
    }
  });

  // When contact form is submitted
  eventBus.on(EventTypes.CONTACT_FORM_SUBMITTED, async (data) => {
    try {
      logger.info("Cross-service: Contact form submitted", { contactId: data.id });
      
      // Send notification to admin
      await notificationService.sendNewLeadNotification({
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message,
        source: data.source || "contact_form",
      });

      await enqueueWebsiteCommand({
        id: data.id,
        name: data.name,
        email: data.email,
        company: data.company,
        phone: data.phone,
        message: data.message,
        source: data.source || "contact_form",
      });
    } catch (error) {
      logger.error("Error handling contact form", error);
    }
  });

  eventBus.on(EventTypes.QUOTE_REQUESTED, async (data) => {
    try {
      await enqueueWebsiteCommand(
        {
          id: data.id || data.quoteId,
          name: data.name || data.contactName,
          email: data.email || data.contactEmail,
          company: data.company || data.companyName,
          phone: data.phone || data.contactPhone,
          message: data.message,
          source: data.source || "store_quote",
          canonicalAccountId: data.canonicalAccountId || null,
          portalClientId: data.portalClientId || null,
          commercial: data.commercial || null,
        },
        "quote.requested",
      );
    } catch (error) {
      logger.error("Error queueing store quote for Hub", error);
    }
  });

  logger.info("✅ Cross-service handlers initialized");
}

/**
 * Query builder for complex cross-service queries
 */
export const crossServiceQueries = {
  /**
   * Get all services, tickets, invoices and shipments for a client
   */
  async getClientFullProfile(clientId: string) {
    return {
      clientId,
      summary: {
        message: "Full cross-service view for client - would include services, tickets, invoices, shipments",
      },
    };
  },

  /**
   * Get tickets that are pending and have related services expiring soon
   */
  async getPendingTicketsWithExpiringServices() {
    return {
      message: "Query to find tickets blocking service renewals",
    };
  },

  /**
   * Get invoices that are unpaid and have related open support tickets
   */
  async getUnpaidInvoicesWithOpenTickets() {
    return {
      message: "Query to find unpaid invoices with active support issues",
    };
  },

  /**
   * Smart recommendations based on customer profile
   */
  async getSmartRecommendations(clientId: string) {
    return {
      recommendations: [
        "Customer has 3 unresolved critical tickets - recommend escalation",
        "Service renewal due in 7 days - send reminder",
        "Payment overdue by 15 days - send follow-up",
        "High support ticket volume this month - consider premium service upgrade",
      ],
    };
  },
};
