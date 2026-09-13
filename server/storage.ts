import {
  users,
  workspaces,
  projects,
  boards,
  tasks,
  labels,
  comments,
  attachments,
  workspaceMembers,
  taskLabels,
  activities,
  portalChatMessages,
  portalClients,
  portalUsers as portalUsersTable,
  portalTickets,
  portalTicketComments,
  type User,
  type InsertUser,
  type Workspace,
  type InsertWorkspace,
  type Project,
  type InsertProject,
  type Board,
  type InsertBoard,
  type Task,
  type InsertTask,
  type UpdateTask,
  type Label,
  type InsertLabel,
  type Comment,
  type InsertComment,
  type PortalChatMessage,
  type InsertPortalChatMessage,
  type PortalTicket,
  type PortalTicketComment,
} from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getWorkspace(id: string): Promise<Workspace | undefined>;
  getWorkspacesByUserId(userId: string): Promise<Workspace[]>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  deleteWorkspace(id: string): Promise<void>;

  getProject(id: string): Promise<Project | undefined>;
  getProjectsByWorkspaceId(workspaceId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  getBoard(id: string): Promise<Board | undefined>;
  getBoardsByProjectId(projectId: string): Promise<Board[]>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: string, data: Partial<InsertBoard>): Promise<Board | undefined>;
  deleteBoard(id: string): Promise<void>;

  getTask(id: string): Promise<Task | undefined>;
  getTasksByProjectId(projectId: string): Promise<Task[]>;
  getTasksByBoardId(boardId: string): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: UpdateTask): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;

  getLabel(id: string): Promise<Label | undefined>;
  getLabelsByWorkspaceId(workspaceId: string): Promise<Label[]>;
  createLabel(label: InsertLabel): Promise<Label>;
  deleteLabel(id: string): Promise<void>;

  getCommentsByTaskId(taskId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<void>;

  getChatMessagesByTicketId(ticketId: string): Promise<PortalChatMessage[]>;
  createChatMessage(message: InsertPortalChatMessage): Promise<PortalChatMessage>;
  markMessagesAsRead(ticketId: string): Promise<void>;

  getPortalTicket(id: string): Promise<PortalTicket | undefined>;
  getPortalTickets(userId?: string): Promise<PortalTicket[]>;
  createPortalTicket(ticket: any): Promise<PortalTicket>;
  updatePortalTicket(id: string, data: any): Promise<PortalTicket | undefined>;
  getPortalTicketComments(ticketId: string): Promise<PortalTicketComment[]>;
  createPortalTicketComment(comment: any): Promise<PortalTicketComment>;

  getTenantFilesByClientId(clientId: string): Promise<any[]>;
  createTenantFile(data: { clientId: string; fileName: string; fileType: string; category: string; description: string; fileUrl: string; uploadedBy: string }): Promise<any>;
  deleteTenantFile(id: string): Promise<boolean>;

  getStoreOrders(): Promise<any[]>;
  getStoreOrder(id: string): Promise<any | undefined>;
  createStoreOrder(order: any): Promise<any>;
}

function generateId(): string {
  return crypto.randomUUID();
}

interface PortalClient {
  id: string;
  companyName: string;
  contactEmail: string;
  status: string;
  createdAt: Date;
}

interface PortalUser {
  id: string;
  clientId: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface MemPortalTicket {
  id: string;
  clientId: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string | null;
  assignedTo: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

interface MemPortalTicketComment {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  isInternal: boolean;
  authorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TenantFile {
  id: string;
  clientId: string;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  fileUrl: string;
  uploadedBy: string;
  createdAt: Date;
}

interface MemStoreOrder {
  id: string;
  orderNumber: string;
  userId: string | null;
  clientId: string | null;
  status: string;
  paymentMethod: string | null;
  lineItems: any[];
  subtotal: string;
  tax: string;
  total: string;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  zohoPaymentId: string | null;
  billingEmail: string | null;
  billingName: string | null;
  billingCompany: string | null;
  billingAddress: any | null;
  notes: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private projects: Map<string, Project> = new Map();
  private boards: Map<string, Board> = new Map();
  private tasks: Map<string, Task> = new Map();
  private labels: Map<string, Label> = new Map();
  private comments: Map<string, Comment> = new Map();
  private chatMessages: Map<string, PortalChatMessage> = new Map();
  private portalClients: Map<string, PortalClient> = new Map();
  private portalUsersMap: Map<string, PortalUser> = new Map();
  private portalTicketsMap: Map<string, MemPortalTicket> = new Map();
  private ticketComments: Map<string, MemPortalTicketComment> = new Map();
  private tenantFiles: Map<string, TenantFile> = new Map();
  private storeOrdersMap: Map<string, MemStoreOrder> = new Map();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // Never embed known login credential material in MemStorage. Structural
    // demo users/clients for UI fallback may exist without usable passwords.
    const adminUser: User = {
      id: "admin-1",
      username: "admin@digerati-experts.com",
      email: "admin@digerati-experts.com",
      password: "",
      fullName: "Admin User",
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    const demoClient: PortalClient = {
      id: "client-1",
      companyName: "Acme Corp",
      contactEmail: "admin@acme.com",
      status: "active",
      createdAt: new Date(),
    };
    this.portalClients.set(demoClient.id, demoClient);

    const demoClient2: PortalClient = {
      id: "client-2",
      companyName: "Phoenix Medical Group",
      contactEmail: "it@phoenixmedical.com",
      status: "active",
      createdAt: new Date(),
    };
    this.portalClients.set(demoClient2.id, demoClient2);

    const demoClient3: PortalClient = {
      id: "client-3",
      companyName: "Desert Law Partners",
      contactEmail: "admin@desertlaw.com",
      status: "active",
      createdAt: new Date(),
    };
    this.portalClients.set(demoClient3.id, demoClient3);

    const demoClient4: PortalClient = {
      id: "client-4",
      companyName: "Scottsdale Realty",
      contactEmail: "tech@scottsdalereal.com",
      status: "active",
      createdAt: new Date(),
    };
    this.portalClients.set(demoClient4.id, demoClient4);

    const portalUser: PortalUser = {
      id: "portal-user-1",
      clientId: "client-1",
      email: "admin@digerati-experts.com",
      fullName: "Admin User",
      role: "admin",
      isActive: true,
    };
    this.portalUsersMap.set(portalUser.id, portalUser);

    // Demo client user 1 - Acme Corp employee
    const clientUser1: PortalUser = {
      id: "portal-user-2",
      clientId: "client-1",
      email: "john.smith@acme.com",
      fullName: "John Smith",
      role: "user",
      isActive: true,
    };
    this.portalUsersMap.set(clientUser1.id, clientUser1);

    // Demo client user 2 - Phoenix Medical Group employee
    const clientUser2: PortalUser = {
      id: "portal-user-3",
      clientId: "client-2",
      email: "sarah.jones@phoenixmedical.com",
      fullName: "Sarah Jones",
      role: "user",
      isActive: true,
    };
    this.portalUsersMap.set(clientUser2.id, clientUser2);

    const demoTicket: MemPortalTicket = {
      id: "ticket-1",
      clientId: "client-1",
      ticketNumber: "TKT-001",
      subject: "VPN Connection Issue",
      description: "Unable to connect to company VPN from home office. Getting error 'Connection timeout' after entering credentials.",
      status: "open",
      priority: "high",
      category: "network",
      assignedTo: null,
      createdBy: "portal-user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
    };
    this.portalTicketsMap.set(demoTicket.id, demoTicket);

    const demoTicket2: MemPortalTicket = {
      id: "ticket-2",
      clientId: "client-1",
      ticketNumber: "TKT-002",
      subject: "Email Configuration",
      description: "Need help setting up Microsoft 365 email on new iPhone device",
      status: "in_progress",
      priority: "medium",
      category: "email",
      assignedTo: "tech-1",
      createdBy: "portal-user-1",
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
      resolvedAt: null,
    };
    this.portalTicketsMap.set(demoTicket2.id, demoTicket2);

    const demoTicket3: MemPortalTicket = {
      id: "ticket-3",
      clientId: "client-1",
      ticketNumber: "TKT-003",
      subject: "Slow Computer Performance",
      description: "My workstation has been running very slowly for the past week",
      status: "resolved",
      priority: "low",
      category: "hardware",
      assignedTo: "tech-2",
      createdBy: "portal-user-1",
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(Date.now() - 86400000),
      resolvedAt: new Date(Date.now() - 86400000),
    };
    this.portalTicketsMap.set(demoTicket3.id, demoTicket3);

    const demoComment: MemPortalTicketComment = {
      id: "comment-1",
      ticketId: "ticket-1",
      userId: "portal-user-1",
      content: "I've tried restarting my router but the issue persists. The VPN client shows 'Authentication failed' message.",
      isInternal: false,
      authorName: "Admin User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ticketComments.set(demoComment.id, demoComment);

    const supportComment: MemPortalTicketComment = {
      id: "comment-2",
      ticketId: "ticket-1",
      userId: "support-1",
      content: "Thank you for reporting this issue. I've reset your VPN credentials. Please try connecting again with the new password sent to your email.",
      isInternal: false,
      authorName: "Tech Support",
      createdAt: new Date(Date.now() + 3600000),
      updatedAt: new Date(Date.now() + 3600000),
    };
    this.ticketComments.set(supportComment.id, supportComment);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: generateId(),
      username: user.username,
      password: user.password,
      email: user.email || null,
      fullName: user.fullName || null,
      avatar: user.avatar || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async getWorkspacesByUserId(userId: string): Promise<Workspace[]> {
    return Array.from(this.workspaces.values()).filter(w => w.ownerId === userId);
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const newWorkspace: Workspace = {
      id: generateId(),
      ...workspace,
      description: workspace.description || null,
      icon: workspace.icon || null,
      color: workspace.color || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.workspaces.set(newWorkspace.id, newWorkspace);
    return newWorkspace;
  }

  async updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const workspace = this.workspaces.get(id);
    if (!workspace) return undefined;
    const updated = { ...workspace, ...data, updatedAt: new Date() };
    this.workspaces.set(id, updated);
    return updated;
  }

  async deleteWorkspace(id: string): Promise<void> {
    this.workspaces.delete(id);
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByWorkspaceId(workspaceId: string): Promise<Project[]> {
    return Array.from(this.projects.values()).filter(p => p.workspaceId === workspaceId);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const newProject: Project = {
      id: generateId(),
      ...project,
      description: project.description || null,
      icon: project.icon || null,
      color: project.color || null,
      defaultView: (project as any).defaultView ?? null,
      isFavorite: project.isFavorite ?? false,
      isArchived: (project as any).isArchived ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(newProject.id, newProject);
    return newProject;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const updated = { ...project, ...data, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async getBoard(id: string): Promise<Board | undefined> {
    return this.boards.get(id);
  }

  async getBoardsByProjectId(projectId: string): Promise<Board[]> {
    return Array.from(this.boards.values()).filter(b => b.projectId === projectId);
  }

  async createBoard(board: InsertBoard): Promise<Board> {
    const newBoard: Board = {
      id: generateId(),
      ...board,
      position: (board as any).position ?? 0,
      isCollapsed: (board as any).isCollapsed ?? null,
      color: board.color || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.boards.set(newBoard.id, newBoard);
    return newBoard;
  }

  async updateBoard(id: string, data: Partial<InsertBoard>): Promise<Board | undefined> {
    const board = this.boards.get(id);
    if (!board) return undefined;
    const updated = { ...board, ...data, updatedAt: new Date() };
    this.boards.set(id, updated);
    return updated;
  }

  async deleteBoard(id: string): Promise<void> {
    this.boards.delete(id);
  }

  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.projectId === projectId);
  }

  async getTasksByBoardId(boardId: string): Promise<Task[]> {
    return Array.from(this.tasks.values()).filter(t => t.boardId === boardId);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const newTask: Task = {
      id: generateId(),
      ...task,
      description: task.description || null,
      boardId: task.boardId || null,
      status: task.status || "todo",
      priority: task.priority || "medium",
      position: task.position || 0,
      dueDate: task.dueDate || null,
      startDate: task.startDate || null,
      estimatedHours: task.estimatedHours || null,
      actualHours: task.actualHours || null,
      assigneeId: task.assigneeId || null,
      parentTaskId: task.parentTaskId || null,
      isArchived: task.isArchived || false,
      customFields: task.customFields || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.tasks.set(newTask.id, newTask);
    return newTask;
  }

  async updateTask(id: string, data: UpdateTask): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...data, updatedAt: new Date() };
    if ((data.status as string) === "done") {
      updated.completedAt = new Date();
    }
    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    this.tasks.delete(id);
  }

  async getLabel(id: string): Promise<Label | undefined> {
    return this.labels.get(id);
  }

  async getLabelsByWorkspaceId(workspaceId: string): Promise<Label[]> {
    return Array.from(this.labels.values()).filter(l => l.workspaceId === workspaceId);
  }

  async createLabel(label: InsertLabel): Promise<Label> {
    const newLabel: Label = {
      id: generateId(),
      ...label,
      createdAt: new Date(),
    };
    this.labels.set(newLabel.id, newLabel);
    return newLabel;
  }

  async deleteLabel(id: string): Promise<void> {
    this.labels.delete(id);
  }

  async getCommentsByTaskId(taskId: string): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter(c => c.taskId === taskId);
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const newComment: Comment = {
      id: generateId(),
      ...comment,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.comments.set(newComment.id, newComment);
    return newComment;
  }

  async deleteComment(id: string): Promise<void> {
    this.comments.delete(id);
  }

  async getChatMessagesByTicketId(ticketId: string): Promise<PortalChatMessage[]> {
    return Array.from(this.chatMessages.values()).filter(m => m.ticketId === ticketId);
  }

  async createChatMessage(message: InsertPortalChatMessage): Promise<PortalChatMessage> {
    const newMessage: PortalChatMessage = {
      id: generateId(),
      ...message,
      ticketId: message.ticketId || null,
      encryptedContent: null,
      isRead: message.isRead || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.chatMessages.set(newMessage.id, newMessage);
    return newMessage;
  }

  async markMessagesAsRead(ticketId: string): Promise<void> {
    this.chatMessages.forEach((msg, id) => {
      if (msg.ticketId === ticketId) {
        this.chatMessages.set(id, { ...msg, isRead: true });
      }
    });
  }

  async getPortalTicket(id: string): Promise<PortalTicket | undefined> {
    const ticket = this.portalTicketsMap.get(id);
    if (!ticket) return undefined;
    return ticket as unknown as PortalTicket;
  }

  async getPortalTickets(userId?: string): Promise<PortalTicket[]> {
    const tickets = Array.from(this.portalTicketsMap.values());
    if (userId) {
      return tickets.filter(t => t.createdBy === userId) as unknown as PortalTicket[];
    }
    return tickets as unknown as PortalTicket[];
  }

  async createPortalTicket(ticket: any): Promise<PortalTicket> {
    const newTicket: MemPortalTicket = {
      id: generateId(),
      clientId: ticket.clientId || "client-1",
      ticketNumber: `TKT-${String(this.portalTicketsMap.size + 1).padStart(3, '0')}`,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status || "open",
      priority: ticket.priority || "medium",
      category: ticket.category || "general",
      createdBy: ticket.createdBy || ticket.userId || "portal-user-1",
      assignedTo: ticket.assignedTo || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolvedAt: null,
    };
    this.portalTicketsMap.set(newTicket.id, newTicket);
    return newTicket as unknown as PortalTicket;
  }

  async updatePortalTicket(id: string, data: any): Promise<PortalTicket | undefined> {
    const ticket = this.portalTicketsMap.get(id);
    if (!ticket) return undefined;
    const updated = { ...ticket, ...data, updatedAt: new Date() };
    if (data.status === "resolved" && !ticket.resolvedAt) {
      updated.resolvedAt = new Date();
    }
    this.portalTicketsMap.set(id, updated);
    return updated as unknown as PortalTicket;
  }

  async getPortalTicketComments(ticketId: string): Promise<PortalTicketComment[]> {
    const comments = Array.from(this.ticketComments.values())
      .filter(c => c.ticketId === ticketId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return comments as unknown as PortalTicketComment[];
  }

  async createPortalTicketComment(comment: any): Promise<PortalTicketComment> {
    const newComment: MemPortalTicketComment = {
      id: generateId(),
      ticketId: comment.ticketId,
      userId: comment.authorId || comment.userId,
      content: comment.content,
      isInternal: comment.isInternal || false,
      authorName: comment.authorName || "User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ticketComments.set(newComment.id, newComment);
    return newComment as unknown as PortalTicketComment;
  }

  async getTenantFilesByClientId(clientId: string): Promise<TenantFile[]> {
    return Array.from(this.tenantFiles.values()).filter(f => f.clientId === clientId);
  }

  async createTenantFile(data: { clientId: string; fileName: string; fileType: string; category: string; description: string; fileUrl: string; uploadedBy: string }): Promise<TenantFile> {
    const newFile: TenantFile = {
      id: generateId(),
      clientId: data.clientId,
      fileName: data.fileName,
      fileType: data.fileType,
      category: data.category,
      description: data.description,
      fileUrl: data.fileUrl,
      uploadedBy: data.uploadedBy,
      createdAt: new Date(),
    };
    this.tenantFiles.set(newFile.id, newFile);
    return newFile;
  }

  async deleteTenantFile(id: string): Promise<boolean> {
    return this.tenantFiles.delete(id);
  }

  async getStoreOrders(): Promise<any[]> {
    return Array.from(this.storeOrdersMap.values());
  }

  async getStoreOrder(id: string): Promise<any | undefined> {
    return this.storeOrdersMap.get(id);
  }

  async createStoreOrder(order: any): Promise<any> {
    const newOrder: MemStoreOrder = {
      id: order.id || crypto.randomUUID(),
      orderNumber: order.orderNumber || `ORD-${Date.now()}`,
      userId: order.userId || null,
      clientId: order.clientId || null,
      status: order.status || "pending",
      paymentMethod: order.paymentMethod || null,
      lineItems: order.lineItems || [],
      subtotal: order.subtotal || "0",
      tax: order.tax || "0",
      total: order.total || "0",
      stripeSessionId: order.stripeSessionId || null,
      stripePaymentIntentId: order.stripePaymentIntentId || null,
      zohoPaymentId: order.zohoPaymentId || null,
      billingEmail: order.billingEmail || null,
      billingName: order.billingName || null,
      billingCompany: order.billingCompany || null,
      billingAddress: order.billingAddress || null,
      notes: order.notes || null,
      paidAt: order.paidAt || null,
      createdAt: order.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.storeOrdersMap.set(newOrder.id, newOrder);
    return newOrder;
  }
}

export class DatabaseStorage implements IStorage {
  private dbModule: any = null;
  private seeded = false;

  private async getDb() {
    if (!this.dbModule) {
      this.dbModule = await import("./db");
    }
    if (!this.seeded) {
      this.seeded = true;
      await this.seedDemoClients();
    }
    return this.dbModule.db;
  }

  private async seedDemoClients() {
    if (process.env.NODE_ENV === "production") return;
    try {
      const db = this.dbModule.db;
      const demoClients = [
        { id: "client-1", companyName: "Acme Corp", contactEmail: "admin@acme.com", contactPhone: "(480) 555-1001", industry: "Manufacturing", primaryContact: "John Smith", status: "active" },
        { id: "client-2", companyName: "Phoenix Medical Group", contactEmail: "it@phoenixmedical.com", contactPhone: "(480) 555-1002", industry: "Healthcare", primaryContact: "Sarah Jones", status: "active" },
        { id: "client-3", companyName: "Desert Law Partners", contactEmail: "admin@desertlaw.com", contactPhone: "(480) 555-1003", industry: "Legal", primaryContact: "Mike Davis", status: "active" },
        { id: "client-5", companyName: "Alamo Industries", contactEmail: "admin@alamoindustries.com", contactPhone: "(480) 555-1005", industry: "Industrial", primaryContact: "Maria Garcia", status: "active" },
        { id: "client-6", companyName: "SEL Machining", contactEmail: "admin@selmachining.com", contactPhone: "(480) 555-1006", industry: "Manufacturing", primaryContact: "Sel Operations", status: "active" },
      ];
      for (const client of demoClients) {
        const [existing] = await db.select().from(portalClients).where(eq(portalClients.id, client.id));
        if (!existing) {
          await db.insert(portalClients).values(client);
          console.log(`✅ Seeded demo client: ${client.companyName}`);
        }
      }

      // Login-capable demo users only when explicit dev bootstrap hash is provided.
      // Never embed fixed credential hashes in source.
      const { resolveDevPortalAdminPasswordHash, isDevPortalBootstrapAllowed } = await import("./portalAuthStore");
      const demoHash =
        isDevPortalBootstrapAllowed() ? resolveDevPortalAdminPasswordHash() : null;
      if (!demoHash) {
        return;
      }
      const demoPortalUsers = [
        { id: "user-001", clientId: "client-1", email: "john.smith@acme.com", username: "johnsmith", password: demoHash, fullName: "John Smith", role: "admin" as const, storeRole: "managed" as const, emailVerified: true },
        { id: "user-002", clientId: "client-2", email: "sarah.jones@phoenixmedical.com", username: "sarahjones", password: demoHash, fullName: "Sarah Jones", role: "user" as const, storeRole: "managed" as const, emailVerified: true },
      ];
      for (const user of demoPortalUsers) {
        const [existing] = await db.select().from(portalUsersTable).where(eq(portalUsersTable.id, user.id));
        if (!existing) {
          await db.insert(portalUsersTable).values(user);
          console.log(`✅ Seeded demo portal user: ${user.fullName}`);
        }
      }
    } catch (err: any) {
      console.warn("Could not seed demo data:", err?.message);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = await this.getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const db = await this.getDb();
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const db = await this.getDb();
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace || undefined;
  }

  async getWorkspacesByUserId(userId: string): Promise<Workspace[]> {
    const db = await this.getDb();
    const ownedWorkspaces = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId));
    const memberWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        icon: workspaces.icon,
        color: workspaces.color,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));
    
    const allWorkspaces = [...ownedWorkspaces, ...memberWorkspaces];
    const uniqueWorkspaces = Array.from(new Map(allWorkspaces.map(w => [w.id, w])).values());
    return uniqueWorkspaces.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const db = await this.getDb();
    const [created] = await db.insert(workspaces).values(workspace).returning();
    return created;
  }

  async updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const db = await this.getDb();
    const [updated] = await db
      .update(workspaces)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteWorkspace(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const db = await this.getDb();
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByWorkspaceId(workspaceId: string): Promise<Project[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.isFavorite), desc(projects.createdAt));
  }

  async createProject(project: InsertProject): Promise<Project> {
    const db = await this.getDb();
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const db = await this.getDb();
    const [updated] = await db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getBoard(id: string): Promise<Board | undefined> {
    const db = await this.getDb();
    const [board] = await db.select().from(boards).where(eq(boards.id, id));
    return board || undefined;
  }

  async getBoardsByProjectId(projectId: string): Promise<Board[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(boards)
      .where(eq(boards.projectId, projectId))
      .orderBy(asc(boards.position));
  }

  async createBoard(board: InsertBoard): Promise<Board> {
    const db = await this.getDb();
    const [created] = await db.insert(boards).values(board).returning();
    return created;
  }

  async updateBoard(id: string, data: Partial<InsertBoard>): Promise<Board | undefined> {
    const db = await this.getDb();
    const [updated] = await db
      .update(boards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(boards.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteBoard(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(boards).where(eq(boards.id, id));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const db = await this.getDb();
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async getTasksByProjectId(projectId: string): Promise<Task[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.isArchived, false)))
      .orderBy(asc(tasks.position), desc(tasks.createdAt));
  }

  async getTasksByBoardId(boardId: string): Promise<Task[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.boardId, boardId), eq(tasks.isArchived, false)))
      .orderBy(asc(tasks.position));
  }

  async createTask(task: InsertTask): Promise<Task> {
    const db = await this.getDb();
    const [created] = await db.insert(tasks).values(task).returning();
    return created;
  }

  async updateTask(id: string, data: UpdateTask): Promise<Task | undefined> {
    const db = await this.getDb();
    const updateData: any = { ...data, updatedAt: new Date() };
    if ((data.status as string) === "done") {
      updateData.completedAt = new Date();
    } else if (data.status && (data.status as string) !== "done") {
      updateData.completedAt = null;
    }
    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return updated || undefined;
  }

  async deleteTask(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getLabel(id: string): Promise<Label | undefined> {
    const db = await this.getDb();
    const [label] = await db.select().from(labels).where(eq(labels.id, id));
    return label || undefined;
  }

  async getLabelsByWorkspaceId(workspaceId: string): Promise<Label[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(labels)
      .where(eq(labels.workspaceId, workspaceId))
      .orderBy(asc(labels.name));
  }

  async createLabel(label: InsertLabel): Promise<Label> {
    const db = await this.getDb();
    const [created] = await db.insert(labels).values(label).returning();
    return created;
  }

  async deleteLabel(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(labels).where(eq(labels.id, id));
  }

  async getCommentsByTaskId(taskId: string): Promise<Comment[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const db = await this.getDb();
    const [created] = await db.insert(comments).values(comment).returning();
    return created;
  }

  async deleteComment(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(comments).where(eq(comments.id, id));
  }

  async getChatMessagesByTicketId(ticketId: string): Promise<PortalChatMessage[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(portalChatMessages)
      .where(eq(portalChatMessages.ticketId, ticketId))
      .orderBy(asc(portalChatMessages.createdAt));
  }

  async createChatMessage(message: InsertPortalChatMessage): Promise<PortalChatMessage> {
    const db = await this.getDb();
    const [created] = await db.insert(portalChatMessages).values(message).returning();
    return created;
  }

  async markMessagesAsRead(ticketId: string): Promise<void> {
    const db = await this.getDb();
    await db
      .update(portalChatMessages)
      .set({ isRead: true })
      .where(eq(portalChatMessages.ticketId, ticketId));
  }

  async getPortalTicket(id: string): Promise<PortalTicket | undefined> {
    const db = await this.getDb();
    const [ticket] = await db.select().from(portalTickets).where(eq(portalTickets.id, id));
    return ticket || undefined;
  }

  async getPortalTickets(userId?: string): Promise<PortalTicket[]> {
    const db = await this.getDb();
    if (userId) {
      return await db.select().from(portalTickets).where(eq(portalTickets.createdBy, userId));
    }
    return await db.select().from(portalTickets);
  }

  async createPortalTicket(ticket: any): Promise<PortalTicket> {
    const db = await this.getDb();
    const [created] = await db.insert(portalTickets).values(ticket).returning();
    return created;
  }

  async updatePortalTicket(id: string, data: any): Promise<PortalTicket | undefined> {
    const db = await this.getDb();
    const [updated] = await db
      .update(portalTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(portalTickets.id, id))
      .returning();
    return updated || undefined;
  }

  async getPortalTicketComments(ticketId: string): Promise<PortalTicketComment[]> {
    const db = await this.getDb();
    return await db
      .select()
      .from(portalTicketComments)
      .where(eq(portalTicketComments.ticketId, ticketId))
      .orderBy(asc(portalTicketComments.createdAt));
  }

  async createPortalTicketComment(comment: any): Promise<PortalTicketComment> {
    const db = await this.getDb();
    const [created] = await db.insert(portalTicketComments).values({
      id: comment.id || crypto.randomUUID(),
      ticketId: comment.ticketId,
      userId: comment.authorId || comment.userId,
      content: comment.content,
      isInternal: comment.isInternal || false,
      createdAt: comment.createdAt || new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  private tenantFilesCache: Map<string, any> = new Map();
  private storeOrdersMap: Map<string, MemStoreOrder> = new Map();

  async getTenantFilesByClientId(clientId: string): Promise<any[]> {
    return Array.from(this.tenantFilesCache.values()).filter(f => f.clientId === clientId);
  }

  async createTenantFile(data: { clientId: string; fileName: string; fileType: string; category: string; description: string; fileUrl: string; uploadedBy: string }): Promise<any> {
    const newFile = {
      id: crypto.randomUUID(),
      clientId: data.clientId,
      fileName: data.fileName,
      fileType: data.fileType,
      category: data.category,
      description: data.description,
      fileUrl: data.fileUrl,
      uploadedBy: data.uploadedBy,
      createdAt: new Date(),
    };
    this.tenantFilesCache.set(newFile.id, newFile);
    return newFile;
  }

  async deleteTenantFile(id: string): Promise<boolean> {
    return this.tenantFilesCache.delete(id);
  }

  async getStoreOrders(): Promise<any[]> {
    return Array.from(this.storeOrdersMap.values());
  }

  async getStoreOrder(id: string): Promise<any | undefined> {
    return this.storeOrdersMap.get(id);
  }

  async createStoreOrder(order: any): Promise<any> {
    const newOrder: MemStoreOrder = {
      id: order.id || crypto.randomUUID(),
      orderNumber: order.orderNumber || `ORD-${Date.now()}`,
      userId: order.userId || null,
      clientId: order.clientId || null,
      status: order.status || "pending",
      paymentMethod: order.paymentMethod || null,
      lineItems: order.lineItems || [],
      subtotal: order.subtotal || "0",
      tax: order.tax || "0",
      total: order.total || "0",
      stripeSessionId: order.stripeSessionId || null,
      stripePaymentIntentId: order.stripePaymentIntentId || null,
      zohoPaymentId: order.zohoPaymentId || null,
      billingEmail: order.billingEmail || null,
      billingName: order.billingName || null,
      billingCompany: order.billingCompany || null,
      billingAddress: order.billingAddress || null,
      notes: order.notes || null,
      paidAt: order.paidAt || null,
      createdAt: order.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.storeOrdersMap.set(newOrder.id, newOrder);
    return newOrder;
  }
}

let storageInstance: IStorage;
let dbAvailable = false;

async function initializeStorage(): Promise<IStorage> {
  try {
    const dbModule = await import("./db");
    await dbModule.initPromise;
    
    // Check dbReady AFTER initPromise resolves (it's updated in the module)
    const status = dbModule.getDatabaseStatus();
    
    if (status.connected) {
      dbAvailable = true;
      console.log(`✅ Database connected (${status.type}), using DatabaseStorage`);
      return new DatabaseStorage();
    }
  } catch (error) {
    console.log("⚠️ Database module error:", (error as Error).message);
  }
  
  console.log("⚠️ Using MemStorage fallback (database endpoint disabled)");
  return new MemStorage();
}

const memStorageFallback = new MemStorage();
storageInstance = memStorageFallback;

initializeStorage().then(s => {
  storageInstance = s;
}).catch(() => {
  console.log("⚠️ Storage initialization failed, using MemStorage");
  storageInstance = memStorageFallback;
});

export const storage: IStorage = new Proxy({} as IStorage, {
  get(_, prop) {
    return (storageInstance as any)[prop]?.bind(storageInstance);
  }
});

export { dbAvailable };
