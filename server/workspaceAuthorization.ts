export type WorkspaceMembershipRole = "owner" | "admin" | "member" | "viewer";
export type WorkspacePermission = "read" | "mutate" | "destroy";

export function resolveUniqueWorkspaceMembershipRole(
  memberships: ReadonlyArray<{ role: WorkspaceMembershipRole }>,
): WorkspaceMembershipRole | undefined {
  return memberships.length === 1 ? memberships[0]?.role : undefined;
}

export type WorkspaceResource =
  | { kind: "workspace"; id: string }
  | { kind: "project"; id: string }
  | { kind: "board"; id: string }
  | { kind: "task"; id: string }
  | { kind: "label"; id: string }
  | { kind: "comment"; id: string }
  | { kind: "taskContainer"; projectId: string; boardId?: string | null };

export interface WorkspaceAuthorizationStore {
  getWorkspace(id: string): Promise<{ id: string; ownerId: string } | undefined>;
  getWorkspaceMembershipRole(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipRole | undefined>;
  getProject(id: string): Promise<{ id: string; workspaceId: string } | undefined>;
  getBoard(id: string): Promise<{ id: string; projectId: string } | undefined>;
  getTask(
    id: string,
  ): Promise<{ id: string; projectId: string; boardId: string | null } | undefined>;
  getLabel(id: string): Promise<{ id: string; workspaceId: string } | undefined>;
  getComment(id: string): Promise<{ id: string; taskId: string; userId: string } | undefined>;
}

export type WorkspaceAuthorizationResult =
  | {
      ok: true;
      workspaceId: string;
      role: WorkspaceMembershipRole;
    }
  | {
      ok: false;
      status: 403 | 404;
      error: "Insufficient workspace permissions" | "Resource not found";
    };

const RESOURCE_NOT_FOUND: WorkspaceAuthorizationResult = {
  ok: false,
  status: 404,
  error: "Resource not found",
};

const INSUFFICIENT_PERMISSIONS: WorkspaceAuthorizationResult = {
  ok: false,
  status: 403,
  error: "Insufficient workspace permissions",
};

const allowedRoles: Record<WorkspacePermission, ReadonlySet<WorkspaceMembershipRole>> = {
  read: new Set(["owner", "admin", "member", "viewer"]),
  mutate: new Set(["owner", "admin", "member"]),
  destroy: new Set(["owner", "admin"]),
};

async function resolveProjectWorkspaceId(
  store: WorkspaceAuthorizationStore,
  projectId: string,
): Promise<string | null> {
  const project = await store.getProject(projectId);
  if (!project) return null;

  const workspace = await store.getWorkspace(project.workspaceId);
  return workspace?.id ?? null;
}

async function resolveBoardWorkspaceId(
  store: WorkspaceAuthorizationStore,
  boardId: string,
): Promise<string | null> {
  const board = await store.getBoard(boardId);
  if (!board) return null;
  return resolveProjectWorkspaceId(store, board.projectId);
}

async function resolveTaskWorkspaceId(
  store: WorkspaceAuthorizationStore,
  taskId: string,
): Promise<string | null> {
  const task = await store.getTask(taskId);
  if (!task) return null;

  const project = await store.getProject(task.projectId);
  if (!project) return null;

  if (task.boardId) {
    const board = await store.getBoard(task.boardId);
    if (!board || board.projectId !== project.id) return null;
  }

  const workspace = await store.getWorkspace(project.workspaceId);
  return workspace?.id ?? null;
}

async function resolveTaskContainerWorkspaceId(
  store: WorkspaceAuthorizationStore,
  projectId: string,
  boardId?: string | null,
): Promise<string | null> {
  const project = await store.getProject(projectId);
  if (!project) return null;

  if (boardId) {
    const board = await store.getBoard(boardId);
    if (!board || board.projectId !== project.id) return null;
  }

  const workspace = await store.getWorkspace(project.workspaceId);
  return workspace?.id ?? null;
}

async function resolveWorkspaceId(
  store: WorkspaceAuthorizationStore,
  resource: WorkspaceResource,
): Promise<string | null> {
  switch (resource.kind) {
    case "workspace": {
      const workspace = await store.getWorkspace(resource.id);
      return workspace?.id ?? null;
    }
    case "project":
      return resolveProjectWorkspaceId(store, resource.id);
    case "board":
      return resolveBoardWorkspaceId(store, resource.id);
    case "task":
      return resolveTaskWorkspaceId(store, resource.id);
    case "label": {
      const label = await store.getLabel(resource.id);
      if (!label) return null;
      const workspace = await store.getWorkspace(label.workspaceId);
      return workspace?.id ?? null;
    }
    case "comment": {
      const comment = await store.getComment(resource.id);
      if (!comment) return null;
      return resolveTaskWorkspaceId(store, comment.taskId);
    }
    case "taskContainer":
      return resolveTaskContainerWorkspaceId(store, resource.projectId, resource.boardId);
  }
}

export async function authorizeWorkspaceResource(
  store: WorkspaceAuthorizationStore,
  userId: string,
  resource: WorkspaceResource,
  permission: WorkspacePermission,
): Promise<WorkspaceAuthorizationResult> {
  if (!userId) return RESOURCE_NOT_FOUND;

  const workspaceId = await resolveWorkspaceId(store, resource);
  if (!workspaceId) return RESOURCE_NOT_FOUND;

  const role = await store.getWorkspaceMembershipRole(workspaceId, userId);
  if (!role) return RESOURCE_NOT_FOUND;
  if (!allowedRoles[permission].has(role)) return INSUFFICIENT_PERMISSIONS;

  return { ok: true, workspaceId, role };
}
