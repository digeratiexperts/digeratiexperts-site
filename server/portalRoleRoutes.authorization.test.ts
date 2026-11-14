import { once } from "node:events";
import type { Server } from "node:http";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Object-storage authorization is a separate active slice. Keep this route-level
// role test isolated from that adapter's registration contract.
vi.mock("./replit_integrations/object_storage", () => ({
  registerObjectStorageRoutes: vi.fn(),
  isLegacyObjectStorageEnabled: vi.fn(() => false),
  ObjectStorageService: class ObjectStorageService {},
}));

type RoleName = "staff" | "manager" | "dept_it" | "company_it" | "admin";

type ApiResponse = {
  status: number;
  body: Record<string, any>;
  cookieHeader?: string;
  headers: Record<string, string>;
};

const PASSWORD = "PortalRoleTest!42";

const clientWideRoutes = [
  ["billing", "/api/portal/billing"],
  ["company and contacts", "/api/portal/company"],
  ["services", "/api/portal/services"],
  ["invoice list", "/api/portal/invoices"],
  ["invoice detail", "/api/portal/invoices/missing-invoice"],
  ["files", "/api/portal/my-files"],
  ["order list", "/api/portal/orders"],
  ["order detail", "/api/portal/orders/missing-order"],
  ["order receipt", "/api/portal/orders/missing-order/receipt"],
] as const;

describe("portal role route authorization", () => {
  let server: Server;
  let baseUrl: string;
  const cookies = new Map<RoleName, string>();
  const originalEnv = new Map<string, string | undefined>();
  const billingLookupEmails: string[] = [];
  const crmLookupEmails: string[] = [];
  const deskLookupEmails: string[] = [];
  const deskCreatedContactIds: Array<string | undefined> = [];
  let staffQuoteId = "";
  let emailOnlyQuoteId = "";
  let peerQuoteId = "";
  let adminQuoteId = "";
  let targetPortalTicketId = "";
  let adminPortalTicketId = "";

  const isolatedEnvironmentKeys = [
    "DATABASE_URL",
    "TURNSTILE_SECRET_KEY",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_ID_API",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_CLIENT_SECRET_API",
    "ZOHO_REFRESH_TOKEN",
    "ZOHO_PAYMENTS_ACCOUNT_ID",
    "ZOHO_PAYMENTS_CLIENT_ID",
    "ZOHO_PAYMENTS_CLIENT_SECRET",
    "ZOHO_PAYMENTS_REFRESH_TOKEN",
    "TECHSALES_SYNC_URL",
    "TECHSALES_SYNC_TOKEN",
    "PORTAL_ENABLE_DEMO_DATA",
    "PORTAL_DEMO_PASSWORD_HASH",
  ];

  function portalCookieHeader(headers: Headers): string {
    const cookieHeaders = headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = cookieHeaders.getSetCookie?.()
      ?? (cookieHeaders.get("set-cookie") || "")
        .split(/,(?=\s*(?:portalSession|portalAuth)=)/i)
        .filter(Boolean);
    return setCookies
      .map((value) => value.split(";", 1)[0])
      .filter((value) => /^(?:portalSession|portalAuth)=/i.test(value))
      .join("; ");
  }

  async function request(
    path: string,
    role: RoleName,
    method = "GET",
    body?: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Cookie: cookies.get(role) || "",
        Origin: baseUrl,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = response.headers.get("content-type") || "";
    return {
      status: response.status,
      body: contentType.includes("application/json")
        ? await response.json() as Record<string, any>
        : {},
      cookieHeader: portalCookieHeader(response.headers) || undefined,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  async function anonymousRequest(path: string): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, { headers: { Origin: baseUrl } });
    const contentType = response.headers.get("content-type") || "";
    return {
      status: response.status,
      body: contentType.includes("application/json")
        ? await response.json() as Record<string, any>
        : {},
      cookieHeader: portalCookieHeader(response.headers) || undefined,
      headers: Object.fromEntries(response.headers.entries()),
    };
  }

  async function login(role: RoleName, email: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/portal/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl,
      },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    expect(response.status).toBe(200);

    const cookieHeader = portalCookieHeader(response.headers);
    expect(cookieHeader).toContain("portalSession=");
    expect(cookieHeader).toContain("portalAuth=");
    cookies.set(role, cookieHeader);
  }

  beforeAll(async () => {
    for (const key of isolatedEnvironmentKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    originalEnv.set("NODE_ENV", process.env.NODE_ENV);
    process.env.NODE_ENV = "test";

    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    const [{ registerRoutes }, portalAuth, storageModule] = await Promise.all([
      import("./routes"),
      import("./portalAuthStore"),
      import("./storage"),
    ]);
    await registerRoutes(app);
    await storageModule.storageReady;

    const [zohoClientModule, billingModule, crmModule, deskModule, quoteStore] = await Promise.all([
      import("./zoho/zohoClient"),
      import("./zoho/zohoBilling"),
      import("./zoho/zohoCRM"),
      import("./zoho/zohoDesk"),
      import("./storeQuoteStore"),
    ]);
    vi.spyOn(zohoClientModule.zohoClient, "isConfigured").mockReturnValue(true);
    vi.spyOn(billingModule.zohoBillingService, "getCustomerByEmail").mockImplementation(async (email) => {
      billingLookupEmails.push(email);
      const target = email === "target-billing@role.test" || email === "company-it@role.test";
      return {
        customer_id: target ? "target-customer" : "admin-customer",
        display_name: target ? "Portal Role Test Company" : "Admin Company",
        email,
      } as any;
    });
    vi.spyOn(billingModule.zohoBillingService, "getSubscriptionsByCustomer").mockImplementation(async (customerId) => {
      const target = customerId === "target-customer";
      return [{
        subscription_id: target ? "target-subscription" : "admin-subscription",
        subscription_number: target ? "TARGET-SUB-1" : "ADMIN-SUB-1",
        name: target ? "Managed IT" : "Admin Internal Service",
        status: "live",
        plan: { name: target ? "Managed IT" : "Admin Internal Service" },
        amount: target ? 2500 : 9999,
        next_billing_at: "2026-09-01",
        zohoLink: `https://billing.zoho.com/app#/subscriptions/${customerId}`,
      } as any];
    });
    vi.spyOn(billingModule.zohoBillingService, "getInvoicesByCustomer").mockImplementation(async (customerId) => {
      const target = customerId === "target-customer";
      return [{
        invoice_id: target ? "target-invoice" : "admin-invoice",
        invoice_number: target ? "TARGET-INV-1" : "ADMIN-INV-1",
        status: "unpaid",
        total: target ? 2500 : 9999,
        balance: target ? 2500 : 9999,
        invoice_date: "2026-08-01",
        due_date: "2026-09-01",
        currency_code: "USD",
        zohoLink: `https://billing.zoho.com/app#/invoices/${customerId}`,
      } as any];
    });
    vi.spyOn(crmModule.zohoCRMService, "getContactByEmail").mockImplementation(async (email) => {
      crmLookupEmails.push(email);
      const target = email === "target-billing@role.test" || email === "company-it@role.test";
      return {
        id: target ? "target-contact" : "admin-contact",
        Full_Name: target ? "Company IT" : "DE Admin",
        Email: email,
        Account_Name: {
          id: target ? "target-account" : "admin-account",
          name: target ? "Portal Role Test Company" : "Admin Company",
        },
      } as any;
    });
    vi.spyOn(crmModule.zohoCRMService, "getAccountById").mockImplementation(async (accountId) => ({
      id: accountId,
      Account_Name: accountId === "target-account" ? "Portal Role Test Company" : "Admin Company",
      zohoLink: `https://crm.zoho.com/crm/org/tab/Accounts/${accountId}`,
    } as any));
    vi.spyOn(crmModule.zohoCRMService, "getContactsByAccount").mockImplementation(async (accountId) => [{
      id: accountId === "target-account" ? "target-contact" : "admin-contact",
      Full_Name: accountId === "target-account" ? "Company IT" : "DE Admin",
      Email: accountId === "target-account" ? "target-billing@role.test" : "admin-billing@role.test",
      zohoLink: `https://crm.zoho.com/crm/org/tab/Contacts/${accountId}`,
    } as any]);
    const deskContactsByEmail: Record<string, { id: string; email: string; accountId: string }> = {
      "staff@role.test": { id: "staff-contact", email: "staff@role.test", accountId: "target-account" },
      "manager@role.test": { id: "manager-contact", email: "manager@role.test", accountId: "target-account" },
      "dept-it@role.test": { id: "dept-it-contact", email: "dept-it@role.test", accountId: "target-account" },
      "company-it@role.test": { id: "company-it-contact", email: "company-it@role.test", accountId: "target-account" },
      "target-billing@role.test": { id: "target-primary-contact", email: "target-billing@role.test", accountId: "target-account" },
      "admin@role.test": { id: "admin-contact", email: "admin@role.test", accountId: "admin-account" },
      "admin-billing@role.test": { id: "admin-primary-contact", email: "admin-billing@role.test", accountId: "admin-account" },
    };
    const deskTicketsById: Record<string, any> = {
      "staff-ticket": {
        id: "staff-ticket",
        ticketNumber: "T-STAFF",
        subject: "Staff-owned ticket",
        description: "Personal support issue",
        status: "Open",
        priority: "Medium",
        channel: "Web",
        contactId: "staff-contact",
        departmentId: "support",
        assigneeId: "agent",
        createdTime: "2026-08-23T00:00:00Z",
        modifiedTime: "2026-08-23T00:00:00Z",
      },
      "peer-ticket": {
        id: "peer-ticket",
        ticketNumber: "T-PEER",
        subject: "Company-wide ticket",
        description: "Another employee's support issue",
        status: "Open",
        priority: "High",
        channel: "Web",
        contactId: "company-it-contact",
        departmentId: "support",
        assigneeId: "agent",
        createdTime: "2026-08-23T00:00:00Z",
        modifiedTime: "2026-08-23T00:00:00Z",
      },
      "admin-ticket": {
        id: "admin-ticket",
        ticketNumber: "T-ADMIN",
        subject: "Administrator tenant ticket",
        description: "Must not cross an impersonation boundary",
        status: "Open",
        priority: "Medium",
        channel: "Web",
        contactId: "admin-contact",
        departmentId: "support",
        assigneeId: "agent",
        createdTime: "2026-08-23T00:00:00Z",
        modifiedTime: "2026-08-23T00:00:00Z",
      },
    };
    vi.spyOn(deskModule.zohoDeskService, "getTicketById").mockImplementation(async (ticketId) => (
      deskTicketsById[ticketId] || null
    ));
    vi.spyOn(deskModule.zohoDeskService, "getContactByEmail").mockImplementation(async (email) => {
      deskLookupEmails.push(email);
      return (deskContactsByEmail[email.toLowerCase()] || null) as any;
    });
    vi.spyOn(deskModule.zohoDeskService, "getContactById").mockImplementation(async (contactId) => (
      Object.values(deskContactsByEmail).find((contact) => contact.id === contactId) || null
    ) as any);
    vi.spyOn(deskModule.zohoDeskService, "getTicketsByContact").mockImplementation(async (contactId) => (
      Object.values(deskTicketsById).filter((ticket) => ticket.contactId === contactId)
    ));
    vi.spyOn(deskModule.zohoDeskService, "createTicket").mockImplementation(async (ticket) => {
      deskCreatedContactIds.push(ticket.contactId);
      return { id: "zoho-created-target-ticket" } as any;
    });

    const password = await bcrypt.hash(PASSWORD, 4);
    portalAuth.setClient({
      id: "role-test-client",
      companyName: "Portal Role Test Company",
      contactEmail: "target-billing@role.test",
      contactPhone: null,
      industry: "Testing",
      primaryContact: "Company IT",
      status: "active",
      type: "client",
      serviceType: "managed",
      createdAt: new Date(),
    });
    portalAuth.setClient({
      id: "role-admin-client",
      companyName: "Admin Company",
      contactEmail: "admin-billing@role.test",
      contactPhone: null,
      industry: "Administration",
      primaryContact: "DE Admin",
      status: "active",
      type: "client",
      serviceType: "managed",
      createdAt: new Date(),
    });

    const users = [
      { roleName: "staff", id: "role-staff", email: "staff@role.test", orgRole: "staff", role: "user" },
      { roleName: "manager", id: "role-manager", email: "manager@role.test", orgRole: "manager", role: "user" },
      { roleName: "dept_it", id: "role-dept-it", email: "dept-it@role.test", orgRole: "dept_it_contact", role: "user" },
      { roleName: "company_it", id: "role-company-it", email: "company-it@role.test", orgRole: "company_it_contact", role: "user", isCompanyItContact: true },
      { roleName: "admin", id: "role-admin", email: "admin@role.test", orgRole: "staff", role: "admin" },
    ] as const;

    for (const user of users) {
      portalAuth.setUser({
        id: user.id,
        email: user.email,
        username: user.id,
        password,
        role: user.role,
        storeRole: user.role === "admin" ? "admin" : "managed",
        fullName: user.id,
        clientId: user.role === "admin" ? "role-admin-client" : "role-test-client",
        orgRole: user.orgRole,
        isCompanyItContact: "isCompanyItContact" in user && user.isCompanyItContact,
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
      });
    }

    await storageModule.storage.createTenantFile({
      clientId: "role-test-client",
      fileName: "target-file.pdf",
      fileType: "document",
      category: "general",
      description: "Target tenant file",
      fileUrl: "target-file.pdf",
      uploadedBy: "role-admin",
    });
    await storageModule.storage.createTenantFile({
      clientId: "role-admin-client",
      fileName: "admin-file.pdf",
      fileType: "document",
      category: "general",
      description: "Administrator tenant file",
      fileUrl: "admin-file.pdf",
      uploadedBy: "role-admin",
    });
    await storageModule.storage.createStoreOrder({
      id: "staff-order",
      orderNumber: "STAFF-ORDER-1",
      userId: "role-staff",
      clientId: "role-test-client",
      status: "paid",
      lineItems: [{ sku: "SAFE-SKU", name: "Staff Service", quantity: 1, unitPrice: 125, total: 125 }],
      subtotal: "125",
      tax: "0",
      total: "125",
      billingEmail: "staff@role.test",
      billingName: "Staff Buyer",
    });
    await storageModule.storage.createStoreOrder({
      id: "target-order",
      orderNumber: "TARGET-ORDER-1",
      userId: "role-company-it",
      clientId: "role-test-client",
      status: "paid",
      lineItems: [],
      total: "2500",
      billingName: "Target Buyer",
    });
    await storageModule.storage.createStoreOrder({
      id: "admin-order",
      orderNumber: "ADMIN-ORDER-1",
      userId: "role-admin",
      clientId: "role-admin-client",
      status: "paid",
      lineItems: [],
      total: "9999",
      billingName: "Admin Buyer",
    });
    const targetPortalTicket = await storageModule.storage.createPortalTicket({
      clientId: "role-test-client",
      createdBy: "role-company-it",
      subject: "Target tenant portal ticket",
      description: "Target tenant support request",
      status: "open",
      priority: "medium",
      category: "support",
      assignedTo: "zoho:target-portal-ticket",
    });
    targetPortalTicketId = targetPortalTicket.id;
    const adminPortalTicket = await storageModule.storage.createPortalTicket({
      clientId: "role-admin-client",
      createdBy: "role-admin",
      subject: "Administrator portal ticket",
      description: "Must not cross an impersonation boundary",
      status: "open",
      priority: "medium",
      category: "internal",
      assignedTo: "zoho:admin-portal-ticket",
    });
    adminPortalTicketId = adminPortalTicket.id;
    await storageModule.storage.createPortalTicketComment({
      ticketId: targetPortalTicketId,
      authorId: "role-company-it",
      authorName: "Company IT",
      content: "Target public reply",
      isInternal: false,
    });
    await storageModule.storage.createPortalTicketComment({
      ticketId: targetPortalTicketId,
      authorId: "role-admin",
      authorName: "DE Internal",
      content: "Target private support note",
      isInternal: true,
    });

    const quoteLine = [{
      productId: "role-test-product",
      sku: "ROLE-TEST-SKU",
      name: "Role Test Service",
      quantity: 1,
      unitPrice: 125,
      listPrice: 125,
      pricingType: "monthly" as const,
      total: 125,
      contractOnly: false,
    }];
    const staffQuote = await quoteStore.insertQuoteRequest({
      quoteNumber: "QR-STAFF-1",
      userId: "role-staff",
      clientId: "role-test-client",
      contactName: "Staff User",
      contactEmail: "staff@role.test",
      requestedItems: quoteLine,
    });
    const peerQuote = await quoteStore.insertQuoteRequest({
      quoteNumber: "QR-\"..\\unsafe\r\nInjected-Header",
      userId: "role-company-it",
      clientId: "role-test-client",
      contactName: "Company IT",
      contactEmail: "company-it@role.test",
      requestedItems: quoteLine,
    });
    const emailOnlyQuote = await quoteStore.insertQuoteRequest({
      quoteNumber: "QR-LEGACY-EMAIL-1",
      userId: null,
      clientId: null,
      contactName: "Legacy Manager Quote",
      contactEmail: "manager@role.test",
      requestedItems: quoteLine,
    });
    const adminQuote = await quoteStore.insertQuoteRequest({
      quoteNumber: "QR-ADMIN-1",
      userId: "role-admin",
      clientId: "role-admin-client",
      contactName: "Administrator",
      contactEmail: "admin@role.test",
      requestedItems: quoteLine,
    });
    staffQuoteId = staffQuote.id;
    emailOnlyQuoteId = emailOnlyQuote.id;
    peerQuoteId = peerQuote.id;
    adminQuoteId = adminQuote.id;

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;

    for (const user of users) {
      await login(user.roleName, user.email);
    }
  }, 30_000);

  afterAll(async () => {
    if (server) {
      server.close();
      await once(server, "close");
    }
    for (const key of [...isolatedEnvironmentKeys, "NODE_ENV"]) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.restoreAllMocks();
  });

  it.each(["staff", "manager"] as const)(
    "prevents %s users from bypassing hidden navigation for client-wide records",
    async (role) => {
      for (const [name, path] of clientWideRoutes) {
        const response = await request(path, role);
        expect(response, name).toMatchObject({
          status: 403,
          body: { error: "Company-wide portal access required" },
        });
      }
      for (const path of ["/api/portal/payment/zoho", "/api/portal/payment/checkout"]) {
        expect(await request(path, role, "POST", { invoiceId: "zoho-invoice" })).toMatchObject({
          status: 403,
          body: { error: "Company-wide portal access required" },
        });
      }
    },
  );

  it.each(["dept_it", "company_it", "admin"] as const)(
    "allows the %s role through the client-wide release gate",
    async (role) => {
      for (const [name, path] of clientWideRoutes) {
        const response = await request(path, role);
        expect(response.status, name).not.toBe(403);
      }
    },
  );

  it("keeps public-site support-agent actions admin-only without disabling normal client chat", async () => {
    const normalClientChat = await request("/api/portal/chat/messages", "company_it");
    expect(normalClientChat.status).toBe(200);

    const clientConversationList = await request("/api/portal/desk-chats", "company_it");
    expect(clientConversationList.status).toBe(200);

    const supportActions = [
      ["/api/portal/desk-chats/missing-session/reply", { content: "Client cannot impersonate support" }],
      ["/api/portal/desk-chats/missing-session/claim", {}],
      ["/api/portal/desk-chats/missing-session/release", {}],
    ] as const;

    for (const [path, body] of supportActions) {
      expect(await request(path, "company_it", "POST", body)).toMatchObject({
        status: 403,
        body: { error: "Admin access required" },
      });
      expect((await request(path, "admin", "POST", body)).status).toBe(404);
    }
  });

  it("omits internal Zoho administrator URLs from client API responses", async () => {
    const dashboard = await request("/api/portal/dashboard", "company_it");
    const billing = await request("/api/portal/billing", "company_it");
    const company = await request("/api/portal/company", "company_it");

    expect(dashboard.status).toBe(200);
    expect(billing.status).toBe(200);
    expect(company.status).toBe(200);

    expect(dashboard.body.services[0]).not.toHaveProperty("zohoLink");
    expect(billing.body.subscription).not.toHaveProperty("zohoLink");
    expect(billing.body.invoices[0]).not.toHaveProperty("zohoLink");
    expect(company.body.account).not.toHaveProperty("zohoLink");
    expect(company.body.contacts[0]).not.toHaveProperty("zohoLink");

    const serialized = JSON.stringify({
      dashboard: dashboard.body,
      billing: billing.body,
      company: company.body,
    });
    expect(serialized).not.toMatch(/billing\.zoho\.com\/app#|crm\.zoho\.com\/crm\/org/i);
  });

  it.each(["staff", "manager"] as const)(
    "keeps the dashboard available while omitting client-wide financial and service fields for %s",
    async (role) => {
      const dashboard = await request("/api/portal/dashboard", role);
      expect(dashboard.status).toBe(200);
      expect(dashboard.body).toMatchObject({
        openTickets: expect.any(Number),
        resolvedTickets: expect.any(Number),
        recentTickets: expect.any(Array),
      });
      expect(dashboard.body).not.toHaveProperty("activeServices");
      expect(dashboard.body).not.toHaveProperty("pendingInvoices");
      expect(dashboard.body).not.toHaveProperty("services");
    },
  );

  it("retains the client-wide dashboard summary for a company IT contact", async () => {
    const companyItDashboard = await request("/api/portal/dashboard", "company_it");
    expect(companyItDashboard.status).toBe(200);
    expect(companyItDashboard.body).toMatchObject({
      activeServices: 1,
      pendingInvoices: 1,
      services: [expect.objectContaining({ serviceName: "Managed IT", amount: 2500 })],
    });
  });

  it("secures legacy billing aliases with live client-wide roles, effective contact lookup, and safe DTOs", async () => {
    for (const role of ["staff", "manager"] as const) {
      expect(await request("/api/zoho/billing/my-subscription", role)).toMatchObject({
        status: 403,
        body: { error: "Company-wide portal access required" },
      });
      expect(await request("/api/zoho/billing/my-invoices", role)).toMatchObject({
        status: 403,
        body: { error: "Company-wide portal access required" },
      });
    }

    billingLookupEmails.length = 0;
    const subscriptions = await request("/api/zoho/billing/my-subscription", "company_it");
    const invoices = await request("/api/zoho/billing/my-invoices", "company_it");
    expect(subscriptions).toMatchObject({
      status: 200,
      body: {
        subscriptions: [expect.objectContaining({ subscription_id: "target-subscription" })],
        customer: expect.objectContaining({ customer_id: "target-customer" }),
      },
    });
    expect(invoices).toMatchObject({
      status: 200,
      body: { invoices: [expect.objectContaining({ invoice_id: "target-invoice" })] },
    });
    expect(billingLookupEmails).toEqual([
      "target-billing@role.test",
      "target-billing@role.test",
    ]);
    const serialized = JSON.stringify({ subscriptions: subscriptions.body, invoices: invoices.body });
    expect(serialized).not.toMatch(/zohoLink|billing\.zoho\.com|admin-billing@role\.test/i);
    expect(Object.keys(subscriptions.body.subscriptions[0]).sort()).toEqual([
      "amount",
      "current_term_ends_at",
      "name",
      "next_billing_at",
      "plan",
      "status",
      "subscription_id",
      "subscription_number",
    ]);
    expect(Object.keys(invoices.body.invoices[0]).sort()).toEqual([
      "balance",
      "currency_code",
      "due_date",
      "invoice_date",
      "invoice_id",
      "invoice_number",
      "status",
      "total",
    ]);
  });

  it("limits quote detail and PDF access to personal ownership or a live client-wide role", async () => {
    expect((await request(`/api/store/quote-requests/${staffQuoteId}`, "staff")).status).toBe(200);
    expect((await request(`/api/store/quote-requests/${emailOnlyQuoteId}`, "manager")).status).toBe(200);
    expect((await request(`/api/store/quote-requests/${emailOnlyQuoteId}`, "staff")).status).toBe(403);
    expect((await request(`/api/store/quote-requests/${peerQuoteId}`, "staff")).status).toBe(403);
    expect((await request(`/api/store/quote-requests/${staffQuoteId}`, "company_it")).status).toBe(200);
    expect((await request(`/api/store/quote-requests/${peerQuoteId}`, "company_it")).status).toBe(200);
    expect((await request(`/api/store/quote-requests/${adminQuoteId}`, "company_it")).status).toBe(403);
    expect((await request(`/api/store/quote-requests/${adminQuoteId}`, "admin")).status).toBe(200);

    const pdf = await request(`/api/store/quote-requests/${peerQuoteId}/pdf`, "company_it");
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect(pdf.headers["content-disposition"]).toMatch(/^attachment; filename="[A-Za-z0-9._-]{1,96}\.pdf"$/);
    expect(pdf.headers["content-disposition"]).not.toMatch(/[\\/\r\n]/);
    expect(pdf.headers["x-content-type-options"]).toBe("nosniff");
    expect(pdf.headers["cache-control"]).toContain("no-store");
  });

  it("authorizes the legacy Zoho ticket detail route by personal contact or effective tenant", async () => {
    expect((await request("/api/zoho/desk/tickets/staff-ticket", "staff")).status).toBe(200);
    expect((await request("/api/zoho/desk/tickets/peer-ticket", "staff")).status).toBe(404);
    expect((await request("/api/zoho/desk/tickets/staff-ticket", "company_it")).status).toBe(200);
    expect((await request("/api/zoho/desk/tickets/peer-ticket", "company_it")).status).toBe(200);
    expect((await request("/api/zoho/desk/tickets/admin-ticket", "company_it")).status).toBe(404);
    expect((await request("/api/zoho/desk/tickets/admin-ticket", "admin")).status).toBe(200);
  });

  it("keeps the unused legacy CRM account detail route non-impersonating-admin only", async () => {
    expect((await anonymousRequest("/api/zoho/crm/accounts/admin-account")).status).toBe(401);
    expect((await request("/api/zoho/crm/accounts/target-account", "company_it")).status).toBe(403);
    expect((await request("/api/zoho/crm/accounts/admin-account", "admin")).status).toBe(200);
  });

  it("requires a live portal session before returning any store order details", async () => {
    expect((await anonymousRequest("/api/store/orders/staff-order")).status).toBe(401);
    expect((await anonymousRequest("/api/store/orders/provider-session-id")).status).toBe(401);
    expect((await request("/api/store/orders/staff-order", "staff")).status).toBe(200);
    expect((await request("/api/store/orders/target-order", "staff")).status).toBe(403);
    expect((await request("/api/store/orders/staff-order", "company_it")).status).toBe(200);
    expect((await request("/api/store/orders/target-order", "company_it")).status).toBe(200);
    expect((await request("/api/store/orders/admin-order", "company_it")).status).toBe(403);
    expect((await request("/api/store/orders/admin-order", "admin")).status).toBe(200);
  });

  it("uses only the authoritative target tenant while an administrator is impersonating", async () => {
    billingLookupEmails.length = 0;
    crmLookupEmails.length = 0;
    deskLookupEmails.length = 0;
    deskCreatedContactIds.length = 0;

    const impersonation = await request(
      "/api/portal/admin/impersonate",
      "admin",
      "POST",
      { companyId: "role-test-client" },
    );
    expect(impersonation).toMatchObject({ status: 200 });
    expect(impersonation.cookieHeader).toContain("portalSession=");
    expect(impersonation.cookieHeader).toContain("portalAuth=");
    cookies.set("admin", impersonation.cookieHeader || "");

    const [me, dashboard, billing, company, services, invoices, files, orders] = await Promise.all([
      request("/api/portal/me", "admin"),
      request("/api/portal/dashboard", "admin"),
      request("/api/portal/billing", "admin"),
      request("/api/portal/company", "admin"),
      request("/api/portal/services", "admin"),
      request("/api/portal/invoices", "admin"),
      request("/api/portal/my-files", "admin"),
      request("/api/portal/orders", "admin"),
    ]);

    expect(me).toMatchObject({
      status: 200,
      body: {
        user: {
          impersonatingCompanyId: "role-test-client",
          impersonatingCompanyName: "Portal Role Test Company",
          impersonatingCompany: {
            id: "role-test-client",
            companyName: "Portal Role Test Company",
          },
        },
      },
    });
    expect(dashboard).toMatchObject({
      status: 200,
      body: {
        activeServices: 1,
        pendingInvoices: 1,
        services: [expect.objectContaining({ id: "target-subscription", amount: 2500 })],
      },
    });
    expect(billing).toMatchObject({
      status: 200,
      body: {
        subscription: expect.objectContaining({ subscription_id: "target-subscription" }),
        invoices: [expect.objectContaining({ invoice_id: "target-invoice" })],
      },
    });
    expect(company).toMatchObject({
      status: 200,
      body: { account: expect.objectContaining({ id: "target-account" }) },
    });
    expect(services).toMatchObject({
      status: 200,
      body: [expect.objectContaining({ id: "target-subscription" })],
    });
    expect(invoices).toMatchObject({
      status: 200,
      body: { invoices: [expect.objectContaining({ id: "target-invoice" })] },
    });
    expect(files).toMatchObject({
      status: 200,
      body: {
        companyName: "Portal Role Test Company",
        files: [expect.objectContaining({ fileName: "target-file.pdf" })],
      },
    });
    expect(orders.status).toBe(200);
    expect(orders.body.storeOrders.map((order: any) => order.id).sort()).toEqual([
      "staff-order",
      "target-order",
    ]);

    expect((await request("/api/portal/invoices/target-invoice", "admin")).status).toBe(200);
    expect((await request("/api/portal/invoices/admin-invoice", "admin")).status).toBe(404);
    expect((await request("/api/portal/orders/target-order", "admin")).status).toBe(200);
    expect((await request("/api/portal/orders/target-order/receipt", "admin")).status).toBe(200);
    expect((await request("/api/portal/orders/admin-order", "admin")).status).toBe(403);
    expect((await request("/api/portal/orders/admin-order/receipt", "admin")).status).toBe(403);
    expect((await request("/api/zoho/billing/my-subscription", "admin")).body.subscriptions)
      .toEqual([expect.objectContaining({ subscription_id: "target-subscription" })]);
    expect((await request("/api/zoho/billing/my-invoices", "admin")).body.invoices)
      .toEqual([expect.objectContaining({ invoice_id: "target-invoice" })]);
    expect((await request(`/api/store/quote-requests/${peerQuoteId}`, "admin")).status).toBe(200);
    expect((await request(`/api/store/quote-requests/${adminQuoteId}`, "admin")).status).toBe(403);
    const legacyTargetTicket = await request("/api/zoho/desk/tickets/staff-ticket", "admin");
    expect(legacyTargetTicket.status).toBe(200);
    expect(legacyTargetTicket.body).not.toHaveProperty("contactId");
    expect(legacyTargetTicket.body).not.toHaveProperty("departmentId");
    expect(legacyTargetTicket.body).not.toHaveProperty("assigneeId");
    expect((await request("/api/zoho/desk/tickets/admin-ticket", "admin")).status).toBe(404);
    expect((await request("/api/zoho/crm/accounts/target-account", "admin")).status).toBe(403);
    expect((await request("/api/store/orders/target-order", "admin")).status).toBe(200);
    expect((await request("/api/store/orders/admin-order", "admin")).status).toBe(403);

    const portalTicketList = await request("/api/portal/tickets", "admin");
    expect(portalTicketList.status).toBe(200);
    expect(portalTicketList.body.tickets.map((ticket: any) => ticket.id)).toEqual([
      targetPortalTicketId,
    ]);

    const targetPortalTicket = await request(
      `/api/portal/tickets/${targetPortalTicketId}`,
      "admin",
    );
    expect(targetPortalTicket.status).toBe(200);
    expect(JSON.stringify(targetPortalTicket.body)).toContain("Target public reply");
    expect(JSON.stringify(targetPortalTicket.body)).not.toContain("Target private support note");
    expect(targetPortalTicket.body.ticket).not.toHaveProperty("clientId");
    expect(targetPortalTicket.body.ticket).not.toHaveProperty("createdBy");
    expect(targetPortalTicket.body.ticket.assignedTo).toBe("Digerati Experts Support");
    expect((await request(`/api/portal/tickets/${adminPortalTicketId}`, "admin")).status).toBe(404);

    const createdPortalTicket = await request("/api/portal/tickets", "admin", "POST", {
      subject: "Impersonated target request",
      description: "Created on behalf of the active target tenant",
      priority: "high",
      category: "support",
    });
    expect(createdPortalTicket).toMatchObject({
      status: 201,
      body: {
        success: true,
        ticket: expect.objectContaining({ subject: "Impersonated target request" }),
      },
    });
    expect(createdPortalTicket.body.ticket).not.toHaveProperty("clientId");
    expect(createdPortalTicket.body.ticket).not.toHaveProperty("createdBy");
    expect((await request(
      `/api/portal/tickets/${createdPortalTicket.body.ticket.id}`,
      "admin",
    )).status).toBe(200);

    const createdLegacyTicket = await request("/api/zoho/desk/tickets", "admin", "POST", {
      subject: "Legacy target request",
      description: "Created against the active target contact",
      priority: "High",
    });
    expect(createdLegacyTicket.status).toBe(200);
    expect(createdLegacyTicket.body).not.toHaveProperty("contactId");
    expect(createdLegacyTicket.body).not.toHaveProperty("departmentId");
    expect(createdLegacyTicket.body).not.toHaveProperty("assigneeId");

    expect(await request("/api/portal/order-form", "admin", "POST", {
      clientInfo: {
        legalName: "Forged Administrator Company",
        signatoryEmail: "admin@role.test",
      },
      selectedServices: [],
    })).toMatchObject({
      status: 409,
      body: {
        error: "Service order forms require the client signatory to submit from their own portal account",
      },
    });

    expect(billingLookupEmails).toContain("target-billing@role.test");
    expect(crmLookupEmails).toContain("target-billing@role.test");
    expect(deskLookupEmails).toContain("target-billing@role.test");
    expect(billingLookupEmails).not.toContain("admin@role.test");
    expect(billingLookupEmails).not.toContain("admin-billing@role.test");
    expect(crmLookupEmails).not.toContain("admin@role.test");
    expect(crmLookupEmails).not.toContain("admin-billing@role.test");
    expect(deskLookupEmails).not.toContain("admin@role.test");
    expect(deskLookupEmails).not.toContain("admin-billing@role.test");
    expect(deskCreatedContactIds).toEqual([
      "target-primary-contact",
      "target-primary-contact",
    ]);
  });
});
