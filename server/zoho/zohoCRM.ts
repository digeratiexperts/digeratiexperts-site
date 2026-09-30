import { zohoClient } from './zohoClient';

export interface ZohoCRMAccount {
  id: string;
  Account_Name: string;
  Phone: string;
  Website: string;
  Industry: string;
  Billing_Street: string;
  Billing_City: string;
  Billing_State: string;
  Billing_Code: string;
  Description: string;
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoCRMContact {
  id: string;
  First_Name: string;
  Last_Name: string;
  Full_Name: string;
  Email: string;
  Phone: string;
  Mobile: string;
  Title: string;
  Department: string;
  Account_Name?: { id: string; name: string };
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoCRMDeal {
  id: string;
  Deal_Name: string;
  Amount: number;
  Stage: string;
  Closing_Date: string;
  Account_Name?: { id: string; name: string };
  Contact_Name?: { id: string; name: string };
  Created_Time: string;
  Modified_Time: string;
}

export interface ZohoCRMLead {
  id?: string;
  First_Name?: string;
  Last_Name: string;
  Email: string;
  Phone?: string;
  Company?: string;
  Lead_Source?: string;
  Description?: string;
  Industry?: string;
  Lead_Status?: string;
  Created_Time?: string;
  Modified_Time?: string;
}

class ZohoCRMService {
  async getAccounts(params?: {
    page?: number;
    per_page?: number;
    fields?: string[];
  }): Promise<{ accounts: ZohoCRMAccount[]; info: any }> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get('/crm/v6/Accounts', {
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 50,
          fields: params?.fields?.join(','),
        },
      });

      return {
        accounts: response.data?.data || [],
        info: response.data?.info || {},
      };
    } catch (error: any) {
      console.error('Error fetching CRM accounts:', error.response?.data || error.message);
      throw error;
    }
  }

  async getAccountById(accountId: string): Promise<ZohoCRMAccount | null> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get(`/crm/v6/Accounts/${accountId}`);

      return response.data?.data?.[0] || null;
    } catch (error: any) {
      console.error('Error fetching account:', error.response?.data || error.message);
      return null;
    }
  }

  async getContacts(params?: {
    page?: number;
    per_page?: number;
    fields?: string[];
  }): Promise<{ contacts: ZohoCRMContact[]; info: any }> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get('/crm/v6/Contacts', {
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 50,
          fields: params?.fields?.join(','),
        },
      });

      return {
        contacts: response.data?.data || [],
        info: response.data?.info || {},
      };
    } catch (error: any) {
      console.error('Error fetching CRM contacts:', error.response?.data || error.message);
      throw error;
    }
  }

  async getContactById(contactId: string): Promise<ZohoCRMContact | null> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get(`/crm/v6/Contacts/${contactId}`);

      return response.data?.data?.[0] || null;
    } catch (error: any) {
      console.error('Error fetching contact:', error.response?.data || error.message);
      return null;
    }
  }

  async searchContacts(criteria: string): Promise<ZohoCRMContact[]> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get('/crm/v6/Contacts/search', {
        params: { criteria },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error searching contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async getContactByEmail(email: string): Promise<ZohoCRMContact | null> {
    const contacts = await this.searchContacts(`(Email:equals:${email})`);
    return contacts[0] || null;
  }

  async getDeals(params?: {
    page?: number;
    per_page?: number;
  }): Promise<{ deals: ZohoCRMDeal[]; info: any }> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get('/crm/v6/Deals', {
        params: {
          page: params?.page || 1,
          per_page: params?.per_page || 50,
        },
      });

      return {
        deals: response.data?.data || [],
        info: response.data?.info || {},
      };
    } catch (error: any) {
      console.error('Error fetching CRM deals:', error.response?.data || error.message);
      throw error;
    }
  }

  async getContactsByAccount(accountId: string): Promise<ZohoCRMContact[]> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get(`/crm/v6/Accounts/${accountId}/Contacts`);

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error fetching account contacts:', error.response?.data || error.message);
      return [];
    }
  }

  async createContact(data: Partial<ZohoCRMContact>): Promise<ZohoCRMContact> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.post('/crm/v6/Contacts', {
        data: [data],
      });

      return response.data?.data?.[0];
    } catch (error: any) {
      console.error('Error creating contact:', error.response?.data || error.message);
      throw error;
    }
  }

  async createAccount(data: Partial<ZohoCRMAccount>): Promise<ZohoCRMAccount> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.post('/crm/v6/Accounts', {
        data: [data],
      });

      return response.data?.data?.[0];
    } catch (error: any) {
      console.error('Error creating account:', error.response?.data || error.message);
      throw error;
    }
  }

  async createLead(data: Partial<ZohoCRMLead>): Promise<ZohoCRMLead> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.post('/crm/v6/Leads', {
        data: [data],
      });

      console.log('✅ Lead created in Zoho CRM:', response.data?.data?.[0]?.details?.id);
      return response.data?.data?.[0];
    } catch (error: any) {
      console.error('Error creating lead:', error.response?.data || error.message);
      throw error;
    }
  }

  async searchLeads(criteria: string): Promise<ZohoCRMLead[]> {
    try {
      const client = await zohoClient.getClient();
      
      const response = await client.get('/crm/v6/Leads/search', {
        params: { criteria },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('Error searching leads:', error.response?.data || error.message);
      return [];
    }
  }

  async getLeadByEmail(email: string): Promise<ZohoCRMLead | null> {
    const leads = await this.searchLeads(`(Email:equals:${email})`);
    return leads[0] || null;
  }

  async searchAccounts(criteria: string): Promise<ZohoCRMAccount[]> {
    try {
      const client = await zohoClient.getClient();
      const response = await client.get("/crm/v6/Accounts/search", {
        params: { criteria },
      });
      return response.data?.data || [];
    } catch (error: any) {
      console.error("Error searching accounts:", error.response?.data || error.message);
      return [];
    }
  }

  async searchDeals(criteria: string): Promise<Array<{ id?: string }>> {
    try {
      const client = await zohoClient.getClient();
      const response = await client.get("/crm/v6/Deals/search", {
        params: { criteria },
      });
      return response.data?.data || [];
    } catch (error: any) {
      console.error("Error searching deals:", error.response?.data || error.message);
      return [];
    }
  }

  async createDeal(data: Partial<ZohoCRMDeal> & { Description?: string }): Promise<any> {
    const client = await zohoClient.getClient();
    const response = await client.post("/crm/v6/Deals", {
      data: [data],
    });
    return response.data?.data?.[0];
  }

  async createQuote(data: Record<string, unknown>): Promise<any> {
    const client = await zohoClient.getClient();
    const response = await client.post("/crm/v6/Quotes", {
      data: [data],
    });
    return response.data?.data?.[0];
  }
}

export const zohoCRMService = new ZohoCRMService();
