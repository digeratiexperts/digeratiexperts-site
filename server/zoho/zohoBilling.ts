import { zohoClient } from './zohoClient';

export interface ZohoSubscription {
  subscription_id: string;
  subscription_number: string;
  name: string;
  status: string;
  plan: {
    plan_code: string;
    name: string;
    price: number;
    billing_cycles: number;
  };
  customer_id: string;
  customer_name: string;
  email: string;
  activated_at: string;
  current_term_starts_at: string;
  current_term_ends_at: string;
  next_billing_at: string;
  amount: number;
  sub_total: number;
  created_time: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  email: string;
  status: string;
  invoice_date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code: string;
  subscription_id?: string;
  payment_made: number;
  created_time: string;
}

export interface ZohoCustomer {
  customer_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  phone: string;
  currency_code: string;
  outstanding: number;
  unused_credits: number;
  created_time: string;
}

/**
 * Strict read result for callers that must tell "no data" from "could not
 * read". Legacy methods below collapse both to [] / null; the portal
 * dashboard uses the strict ones so an outage never renders as a zero.
 */
export type StrictBillingRead<T> = { ok: true; value: T } | { ok: false };

/** Zoho Billing list cap per request; more rows are never fetched here. */
export const STRICT_LIST_PER_PAGE = 200;

type ClientSource = { getClient(): Promise<{ get(url: string, config?: any): Promise<{ data?: any }> }> };

function isRow(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A validated, complete list: Zoho success code, an array of object rows that
 * each carry the id and status fields the caller relies on, and page_context
 * saying there is no further page. Anything else is unavailable, including a
 * partial first page: a count from it would not be an exact total.
 */
function completeList<T>(data: unknown, key: string, idField: string): StrictBillingRead<T[]> {
  if (!isRow(data) || data.code !== 0) return { ok: false };
  const rows = data[key];
  if (!Array.isArray(rows)) return { ok: false };
  if (!rows.every((r) => isRow(r) && typeof r[idField] === "string" && typeof r.status === "string")) return { ok: false };
  const page = data.page_context;
  if (!isRow(page) || page.has_more_page !== false) return { ok: false };
  return { ok: true, value: rows as T[] };
}

export class ZohoBillingService {
  private orgId: string | null = null;

  constructor(private readonly source: ClientSource = zohoClient) {}

  private async getOrgId(): Promise<string> {
    if (this.orgId) return this.orgId;
    
    const client = await this.source.getClient();
    const response = await client.get('/billing/v1/organizations');
    
    if (response.data?.organizations?.[0]?.organization_id) {
      const orgId = response.data.organizations[0].organization_id;
      this.orgId = orgId;
      return orgId;
    }
    
    throw new Error('No Zoho Billing organization found');
  }

  async getSubscriptions(params?: {
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ subscriptions: ZohoSubscription[]; page_context: any }> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/subscriptions', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: {
          status: params?.status,
          page: params?.page || 1,
          per_page: params?.per_page || 25,
        },
      });

      return {
        subscriptions: response.data?.subscriptions || [],
        page_context: response.data?.page_context || {},
      };
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSubscriptionById(subscriptionId: string): Promise<ZohoSubscription | null> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get(`/billing/v1/subscriptions/${subscriptionId}`, {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
      });

      return response.data?.subscription || null;
    } catch (error: any) {
      console.error('Error fetching subscription:', error.response?.data || error.message);
      return null;
    }
  }

  async getSubscriptionsByCustomer(customerId: string): Promise<ZohoSubscription[]> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/subscriptions', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { customer_id: customerId },
      });

      return response.data?.subscriptions || [];
    } catch (error: any) {
      console.error('Error fetching customer subscriptions:', error.response?.data || error.message);
      return [];
    }
  }

  async getInvoices(params?: {
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ invoices: ZohoInvoice[]; page_context: any }> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/invoices', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: {
          status: params?.status,
          page: params?.page || 1,
          per_page: params?.per_page || 25,
        },
      });

      return {
        invoices: response.data?.invoices || [],
        page_context: response.data?.page_context || {},
      };
    } catch (error: any) {
      console.error('Error fetching invoices:', error.response?.data || error.message);
      throw error;
    }
  }

  async getInvoicesByCustomer(customerId: string): Promise<ZohoInvoice[]> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/invoices', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { customer_id: customerId },
      });

      return response.data?.invoices || [];
    } catch (error: any) {
      console.error('Error fetching customer invoices:', error.response?.data || error.message);
      return [];
    }
  }

  async getCustomers(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ customers: ZohoCustomer[]; page_context: any }> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/customers', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 25,
        },
      });

      return {
        customers: response.data?.customers || [],
        page_context: response.data?.page_context || {},
      };
    } catch (error: any) {
      console.error('Error fetching customers:', error.response?.data || error.message);
      throw error;
    }
  }

  async getCustomerByEmail(email: string): Promise<ZohoCustomer | null> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/customers', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { email },
      });

      return response.data?.customers?.[0] || null;
    } catch (error: any) {
      console.error('Error searching customer:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Strict customer lookup. `{ ok: true, value: null }` is a validated
   * no-match; token, organization or provider failures and malformed
   * envelopes are `{ ok: false }`. Never logs the email or provider body.
   */
  async findCustomerByEmailStrict(email: string): Promise<StrictBillingRead<ZohoCustomer | null>> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      const response = await client.get('/billing/v1/customers', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { email },
      });
      const data = response?.data;
      if (!isRow(data) || data.code !== 0 || !Array.isArray(data.customers)) return { ok: false };
      const first = data.customers[0];
      if (first === undefined) return { ok: true, value: null };
      if (!isRow(first) || typeof first.customer_id !== "string" || !first.customer_id) return { ok: false };
      return { ok: true, value: first as unknown as ZohoCustomer };
    } catch {
      console.warn('[zohoBilling] strict customer lookup unavailable');
      return { ok: false };
    }
  }

  /** Strict, complete invoice list for one customer (see completeList). */
  async listInvoicesByCustomerStrict(customerId: string): Promise<StrictBillingRead<ZohoInvoice[]>> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      const response = await client.get('/billing/v1/invoices', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { customer_id: customerId, per_page: STRICT_LIST_PER_PAGE },
      });
      return completeList<ZohoInvoice>(response?.data, 'invoices', 'invoice_id');
    } catch {
      console.warn('[zohoBilling] strict invoice list unavailable');
      return { ok: false };
    }
  }

  /** Strict, complete subscription list for one customer (see completeList). */
  async listSubscriptionsByCustomerStrict(customerId: string): Promise<StrictBillingRead<ZohoSubscription[]>> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      const response = await client.get('/billing/v1/subscriptions', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
        params: { customer_id: customerId, per_page: STRICT_LIST_PER_PAGE },
      });
      return completeList<ZohoSubscription>(response?.data, 'subscriptions', 'subscription_id');
    } catch {
      console.warn('[zohoBilling] strict subscription list unavailable');
      return { ok: false };
    }
  }

  async getPlans(): Promise<any[]> {
    try {
      const client = await this.source.getClient();
      const orgId = await this.getOrgId();
      
      const response = await client.get('/billing/v1/plans', {
        headers: { 'X-com-zoho-subscriptions-organizationid': orgId },
      });

      return response.data?.plans || [];
    } catch (error: any) {
      console.error('Error fetching plans:', error.response?.data || error.message);
      return [];
    }
  }
}

export const zohoBillingService = new ZohoBillingService();
