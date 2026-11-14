import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type ApiResponse = {
  status: number;
  body: Record<string, any>;
};

describe("workspace API authorization", () => {
  let server: Server;
  let baseUrl: string;
  let ownerToken: string;
  let outsiderToken: string;
  let workspaceId: string;
  let projectId: string;
  let boardId: string;
  let taskId: string;
  let labelId: string;
  let commentId: string;

  async function request(
    path: string,
    token: string,
    method = "GET",
    body?: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: response.status,
      body: await response.json() as Record<string, any>,
    };
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;

    const app = express();
    app.use(express.json());
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const owner = await request("/api/auth/register", "", "POST", {
      username: `owner-${suffix}`,
      email: `owner-${suffix}@example.test`,
      password: "SecureTestPassword!42",
      fullName: "Workspace Owner",
    });
    const outsider = await request("/api/auth/register", "", "POST", {
      username: `outsider-${suffix}`,
      email: `outsider-${suffix}@example.test`,
      password: "SecureTestPassword!42",
      fullName: "Workspace Outsider",
    });
    expect(owner.status).toBe(200);
    expect(outsider.status).toBe(200);
    ownerToken = owner.body.token;
    outsiderToken = outsider.body.token;

    const workspace = await request("/api/workspaces", ownerToken, "POST", {
      name: "Authorization Test Workspace",
    });
    expect(workspace.status).toBe(200);
    workspaceId = workspace.body.workspace.id;

    const project = await request("/api/projects", ownerToken, "POST", {
      name: "Authorization Test Project",
      workspaceId,
    });
    expect(project.status).toBe(200);
    projectId = project.body.project.id;

    const board = await request("/api/boards", ownerToken, "POST", {
      name: "Authorization Test Board",
      projectId,
    });
    expect(board.status).toBe(200);
    boardId = board.body.board.id;

    const task = await request("/api/tasks", ownerToken, "POST", {
      title: "Authorization Test Task",
      projectId,
      boardId,
    });
    expect(task.status).toBe(200);
    taskId = task.body.task.id;

    const label = await request("/api/labels", ownerToken, "POST", {
      name: "Authorization Test Label",
      workspaceId,
      color: "#123456",
    });
    expect(label.status).toBe(200);
    labelId = label.body.label.id;

    const comment = await request("/api/comments", ownerToken, "POST", {
      content: "Authorization test comment",
      taskId,
    });
    expect(comment.status).toBe(200);
    commentId = comment.body.comment.id;
  }, 30_000);

  afterAll(async () => {
    if (!server) return;
    server.close();
    await once(server, "close");
  });

  it.each([
    ["workspace", () => `/api/workspaces/${workspaceId}`],
    ["project list", () => `/api/projects?workspaceId=${workspaceId}`],
    ["board list", () => `/api/boards?projectId=${projectId}`],
    ["project task list", () => `/api/tasks?projectId=${projectId}`],
    ["board task list", () => `/api/tasks?boardId=${boardId}`],
    ["label list", () => `/api/labels?workspaceId=${workspaceId}`],
    ["comment list", () => `/api/comments?taskId=${taskId}`],
  ])("returns 404 when an outsider reads another user's %s", async (_name, path) => {
    const response = await request(path(), outsiderToken);
    expect(response).toMatchObject({
      status: 404,
      body: { error: "Resource not found" },
    });
  });

  it.each([
    ["project", () => request("/api/projects", outsiderToken, "POST", { name: "No", workspaceId })],
    ["board", () => request("/api/boards", outsiderToken, "POST", { name: "No", projectId })],
    ["task", () => request("/api/tasks", outsiderToken, "POST", { title: "No", projectId, boardId })],
    ["task update", () => request(`/api/tasks/${taskId}`, outsiderToken, "PATCH", { title: "No" })],
    ["task deletion", () => request(`/api/tasks/${taskId}`, outsiderToken, "DELETE")],
    ["label", () => request("/api/labels", outsiderToken, "POST", { name: "No", workspaceId })],
    ["comment", () => request("/api/comments", outsiderToken, "POST", { content: "No", taskId })],
    ["comment deletion", () => request(`/api/comments/${commentId}`, outsiderToken, "DELETE")],
  ])("returns 404 when an outsider attempts a cross-workspace %s", async (_name, operation) => {
    const response = await operation();
    expect(response).toMatchObject({
      status: 404,
      body: { error: "Resource not found" },
    });
  });

  it("allows the owner to read and mutate resources in the workspace", async () => {
    const workspace = await request(`/api/workspaces/${workspaceId}`, ownerToken);
    const projects = await request(`/api/projects?workspaceId=${workspaceId}`, ownerToken);
    const boards = await request(`/api/boards?projectId=${projectId}`, ownerToken);
    const tasks = await request(`/api/tasks?boardId=${boardId}`, ownerToken);
    const labels = await request(`/api/labels?workspaceId=${workspaceId}`, ownerToken);
    const comments = await request(`/api/comments?taskId=${taskId}`, ownerToken);
    const updatedTask = await request(`/api/tasks/${taskId}`, ownerToken, "PATCH", {
      title: "Owner-updated task",
    });

    expect(workspace.status).toBe(200);
    expect(projects.body.projects).toEqual(expect.arrayContaining([expect.objectContaining({ id: projectId })]));
    expect(boards.body.boards).toEqual(expect.arrayContaining([expect.objectContaining({ id: boardId })]));
    expect(tasks.body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]));
    expect(labels.body.labels).toEqual(expect.arrayContaining([expect.objectContaining({ id: labelId })]));
    expect(comments.body.comments).toEqual(expect.arrayContaining([expect.objectContaining({ id: commentId })]));
    expect(updatedTask).toMatchObject({
      status: 200,
      body: { task: { id: taskId, title: "Owner-updated task" } },
    });
  });

  it("allows the owner to perform destructive operations", async () => {
    const deletedComment = await request(`/api/comments/${commentId}`, ownerToken, "DELETE");
    const deletedTask = await request(`/api/tasks/${taskId}`, ownerToken, "DELETE");

    expect(deletedComment).toMatchObject({ status: 200, body: { success: true } });
    expect(deletedTask).toMatchObject({ status: 200, body: { success: true } });
  });
});
