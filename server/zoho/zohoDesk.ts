import { zohoClient } from './zohoClient';
import {
  clampPriorityForSource,
  deskSourceCustomField,
  wasPriorityClamped,
  withDeskProvenance,
  type DeskTicketSource,
} from "@shared/deskTicketSource";

/** Zoho Desk requires lastName when creating a contact inline on a ticket. */
export function splitVisitorName(
  fullName: string | undefined,
  email: string,
): { firstName?: string; lastName: string } {
  const trimmed = (fullName || "").trim();
  if (!trimmed) {
    return { lastName: email.split("@")[0] || "Visitor" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export interface ZohoTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  channel: string;
  contactId: string;
  departmentId: string;
  assigneeId: string;
  createdTime: string;
  modifiedTime: string;
  closedTime?: string;
  dueDate?: string;
  resolution?: string;
  customerResponseTime?: string;
}

export interface ZohoDeskContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  accountId?: string;
  accountName?: string;
}

class ZohoDeskService {
  private orgId: string | null = null;
  private defaultDepartmentId: string | null = null;

  private async getOrgId(): Promise<string> {
    if (this.orgId) return this.orgId;
    
    const client = await zohoClient.getDeskClient();
    const response = await client.get('/organizations');
    
    if (response.data?.data?.[0]?.id) {
      const orgId = response.data.data[0].id;
      this.orgId = orgId;
      console.log(`✅ Zoho Desk org ID: ${orgId}`);
      return orgId;
    }
    
    throw new Error('No Zoho Desk organization found');
  }

  private async getDefaultDepartmentId(): Promise<string> {
    if (this.defaultDepartmentId) return this.defaultDepartmentId;
    
    try {
      const departments = await this.getDepartments();
      if (departments.length > 0 && departments[0].id) {
        this.defaultDepartmentId = departments[0].id;
        console.log(`✅ Zoho Desk default department: ${departments[0].name || departments[0].id}`);
        return departments[0].id;
      }
    } catch (err: any) {
      // Preserve auth/transport errors so the public route can classify them.
      throw err;
    }
    
    throw new Error('No Zoho Desk department found');
  }

  async getTickets(params?: {
    status?: string;
    limit?: number;
    from?: number;
    sortBy?: string;
  }): Promise<{ tickets: ZohoTicket[]; count: number }> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/tickets', {
        headers: { orgId },
        params: {
          limit: params?.limit || 50,
          from: params?.from || 0,
          status: params?.status,
          sortBy: params?.sortBy || '-modifiedTime',
        },
      });

      return {
        tickets: response.data?.data || [],
        count: response.data?.count || 0,
      };
    } catch (error: any) {
      console.error('Error fetching Zoho Desk tickets:', error.response?.data || error.message);
      throw error;
    }
  }

  async getTicketById(ticketId: string): Promise<ZohoTicket | null> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get(`/tickets/${ticketId}`, {
        headers: { orgId },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error fetching ticket:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Create a Desk ticket.
   *
   * `source` is required: every caller has to say which surface raised the
   * ticket, so triage can tell an anonymous submission from a signed-in
   * client's. Making it optional would let a new call site silently go back to
   * being indistinguishable, which is the bug this parameter exists to fix.
   */
  async createTicket(data: {
    subject: string;
    description: string;
    source: DeskTicketSource;
    contactId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    departmentId?: string;
    priority?: string;
  }): Promise<ZohoTicket> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const departmentId = data.departmentId || await this.getDefaultDepartmentId();
      
      // The description carries the provenance stamp because it needs no Desk
      // configuration. `channel` stays 'Web' deliberately: Desk only accepts
      // channels enabled for the org, and a rejected value fails the whole
      // create — losing a real ticket to tighten a label is a bad trade.
      // Priority is capped here rather than at any one route so a new caller
      // cannot reintroduce the hole: an anonymous submitter ticking "Critical"
      // on the public form must not land in the out-of-hours queue.
      const priority = clampPriorityForSource(data.priority, data.source);
      if (wasPriorityClamped(data.priority, data.source)) {
        console.warn('[DESK] Priority capped for unverified source', {
          source: data.source,
          requested: data.priority,
          applied: priority,
        });
      }

      const ticketData: Record<string, any> = {
        subject: data.subject,
        description: withDeskProvenance(data.description, data.source),
        departmentId,
        priority,
        channel: 'Web',
      };

      const sourceField = deskSourceCustomField(
        data.source,
        process.env.ZOHO_DESK_SOURCE_FIELD,
      );
      if (sourceField) {
        ticketData.cf = { ...(ticketData.cf as object | undefined), ...sourceField };
      }

      if (data.contactId) {
        ticketData.contactId = data.contactId;
      } else if (data.email) {
        const { firstName, lastName } = splitVisitorName(
          [data.firstName, data.lastName].filter(Boolean).join(" ") || undefined,
          data.email,
        );
        ticketData.contact = {
          email: data.email,
          lastName: data.lastName?.trim() || lastName,
          ...(data.firstName?.trim() || firstName
            ? { firstName: data.firstName?.trim() || firstName }
            : {}),
        };
      }
      
      const response = await client.post('/tickets', ticketData, {
        headers: { orgId },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating ticket:', { status: error.response?.status });
      throw error;
    }
  }

  async updateTicket(ticketId: string, data: Partial<ZohoTicket>): Promise<ZohoTicket> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.patch(`/tickets/${ticketId}`, data, {
        headers: { orgId },
      });

      return response.data;
    } catch (error: any) {
      console.error('Error updating ticket:', error.response?.data || error.message);
      throw error;
    }
  }

  async getContacts(params?: {
    limit?: number;
    from?: number;
  }): Promise<{ contacts: ZohoDeskContact[]; count: number }> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/contacts', {
        headers: { orgId },
        params: {
          limit: params?.limit || 50,
          from: params?.from || 0,
        },
      });

      return {
        contacts: response.data?.data || [],
        count: response.data?.count || 0,
      };
    } catch (error: any) {
      console.error('Error fetching contacts:', error.response?.data || error.message);
      throw error;
    }
  }

  async getContactByEmail(email: string): Promise<ZohoDeskContact | null> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/contacts/search', {
        headers: { orgId },
        params: { email },
      });

      return response.data?.data?.[0] || null;
    } catch (error: any) {
      console.error('Error searching contact:', error.response?.data || error.message);
      return null;
    }
  }

  async getTicketsByContact(contactId: string): Promise<ZohoTicket[]> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get(`/contacts/${contactId}/tickets`, {
        headers: { orgId },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching contact tickets:', error.response?.data || error.message);
      return [];
    }
  }

  async getDepartments(): Promise<any[]> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/departments', {
        headers: { orgId },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching departments:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Zoho Desk create-ticket is JSON-only. Attachments must be uploaded after
   * the ticket exists: POST /tickets/{id}/attachments (multipart field `file`).
   */
  async uploadTicketAttachment(
    ticketId: string,
    file: { filename: string; contentType: string; buffer: Buffer },
  ): Promise<{ id?: string }> {
    const client = await zohoClient.getDeskUploadClient();
    const orgId = await this.getOrgId();
    const form = new FormData();
    form.append(
      "file",
      new Blob([file.buffer], { type: file.contentType }),
      file.filename,
    );

    try {
      const response = await client.post(`/tickets/${ticketId}/attachments`, form, {
        headers: { orgId },
      });
      return response.data || {};
    } catch (error: any) {
      console.error(
        "Error uploading Zoho Desk attachment:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async addTicketComment(ticketId: string, content: string): Promise<void> {
    try {
      const client = await zohoClient.getDeskClient();
      const orgId = await this.getOrgId();
      await client.post(
        `/tickets/${ticketId}/comments`,
        { content, isPublic: true },
        { headers: { orgId } },
      );
    } catch (error: any) {
      console.warn(
        "Could not sync comment to Zoho Desk:",
        error.response?.data || error.message,
      );
    }
  }
}

export const zohoDeskService = new ZohoDeskService();
