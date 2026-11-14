import { describe, expect, it } from "vitest";
import {
  authorizeWorkspaceResource,
  resolveUniqueWorkspaceMembershipRole,
  type WorkspaceAuthorizationStore,
  type WorkspaceResource,
} from "./workspaceAuthorization";

const workspaces = {
  "workspace-1": { id: "workspace-1", ownerId: "owner-1" },
  "workspace-2": { id: "workspace-2", ownerId: "owner-2" },
};

const projects = {
  "project-1": { id: "project-1", workspaceId: "workspace-1" },
  "project-2": { id: "project-2", workspaceId: "workspace-2" },
};

const boards = {
  "board-1": { id: "board-1", projectId: "project-1" },
  "board-2": { id: "board-2", projectId: "project-2" },
};

const tasks = {
  "task-1": { id: "task-1", projectId: "project-1", boardId: "board-1" },
  "task-2": { id: "task-2", projectId: "project-2", boardId: "board-2" },
  "task-broken": { id: "task-broken", projectId: "project-1", boardId: "board-2" },
};

const labels = {
  "label-1": { id: "label-1", workspaceId: "workspace-1" },
  "label-2": { id: "label-2", workspaceId: "workspace-2" },
};

const comments = {
  "comment-1": { id: "comment-1", taskId: "task-1", userId: "member-1" },
  "comment-2": { id: "comment-2", taskId: "task-2", userId: "owner-2" },
};

function lookup<T extends object>(records: Record<string, T>, id: string): T | undefined {
  return records[id];
}

function makeStore(): WorkspaceAuthorizationStore {
  return {
    getWorkspace: async (id) => lookup(workspaces, id),
    getWorkspaceMembershipRole: async (workspaceId, userId) => {
      const workspace = lookup(workspaces, workspaceId);
      if (!workspace) return undefined;
      if (workspace.ownerId === userId) return "owner";
      if (workspaceId !== "workspace-1") return undefined;
      if (userId === "admin-1") return "admin";
      if (userId === "member-1") return "member";
      if (userId === "viewer-1") return "viewer";
      return undefined;
    },
    getProject: async (id) => lookup(projects, id),
    getBoard: async (id) => lookup(boards, id),
    getTask: async (id) => lookup(tasks, id),
    getLabel: async (id) => lookup(labels, id),
    getComment: async (id) => lookup(comments, id),
  };
}

const workspaceOneResources: WorkspaceResource[] = [
  { kind: "workspace", id: "workspace-1" },
  { kind: "project", id: "project-1" },
  { kind: "board", id: "board-1" },
  { kind: "task", id: "task-1" },
  { kind: "label", id: "label-1" },
  { kind: "comment", id: "comment-1" },
];

describe("workspace resource authorization", () => {
  it("fails closed when stored membership records are missing or ambiguous", () => {
    expect(resolveUniqueWorkspaceMembershipRole([])).toBeUndefined();
    expect(resolveUniqueWorkspaceMembershipRole([{ role: "member" }])).toBe("member");
    expect(resolveUniqueWorkspaceMembershipRole([
      { role: "admin" },
      { role: "member" },
    ])).toBeUndefined();
    expect(resolveUniqueWorkspaceMembershipRole([
      { role: "member" },
      { role: "member" },
    ])).toBeUndefined();
  });

  it.each(workspaceOneResources)(
    "denies an outsider access to $kind resources without revealing existence",
    async (resource) => {
      await expect(
        authorizeWorkspaceResource(makeStore(), "outsider-1", resource, "read"),
      ).resolves.toEqual({
        ok: false,
        status: 404,
        error: "Resource not found",
      });
    },
  );

  it.each(workspaceOneResources)(
    "allows a workspace member to read $kind resources",
    async (resource) => {
      await expect(
        authorizeWorkspaceResource(makeStore(), "member-1", resource, "read"),
      ).resolves.toMatchObject({
        ok: true,
        workspaceId: "workspace-1",
        role: "member",
      });
    },
  );

  it("allows members to mutate resources but reserves deletion for owners and admins", async () => {
    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "member-1",
        { kind: "task", id: "task-1" },
        "mutate",
      ),
    ).resolves.toMatchObject({ ok: true, role: "member" });

    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "member-1",
        { kind: "task", id: "task-1" },
        "destroy",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Insufficient workspace permissions",
    });

    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "admin-1",
        { kind: "comment", id: "comment-1" },
        "destroy",
      ),
    ).resolves.toMatchObject({ ok: true, role: "admin" });

    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "owner-1",
        { kind: "task", id: "task-1" },
        "destroy",
      ),
    ).resolves.toMatchObject({ ok: true, role: "owner" });
  });

  it("limits viewers to reads", async () => {
    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "viewer-1",
        { kind: "project", id: "project-1" },
        "read",
      ),
    ).resolves.toMatchObject({ ok: true, role: "viewer" });

    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "viewer-1",
        { kind: "project", id: "project-1" },
        "mutate",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 403,
      error: "Insufficient workspace permissions",
    });
  });

  it("rejects a task whose board does not belong to its project", async () => {
    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "owner-1",
        { kind: "task", id: "task-broken" },
        "read",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 404,
      error: "Resource not found",
    });
  });

  it("rejects task creation when the selected board belongs to another project", async () => {
    await expect(
      authorizeWorkspaceResource(
        makeStore(),
        "owner-1",
        { kind: "taskContainer", projectId: "project-1", boardId: "board-2" },
        "mutate",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 404,
      error: "Resource not found",
    });
  });

  it("fails closed when any parent in the hierarchy is missing", async () => {
    const store = makeStore();
    store.getProject = async () => undefined;

    await expect(
      authorizeWorkspaceResource(
        store,
        "owner-1",
        { kind: "comment", id: "comment-1" },
        "read",
      ),
    ).resolves.toEqual({
      ok: false,
      status: 404,
      error: "Resource not found",
    });
  });
});
