import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { Board, Task, UpdateTask } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, MoreHorizontal, Circle, AlertCircle, ArrowUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface KanbanViewProps {
  projectId: string;
  boards: Board[];
  tasks: Task[];
  searchQuery: string;
}

const priorityConfig = {
  low: { icon: Circle, color: "text-slate-400", bg: "bg-slate-100" },
  medium: { icon: Circle, color: "text-blue-500", bg: "bg-blue-100" },
  high: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-100" },
  urgent: { icon: ArrowUp, color: "text-red-500", bg: "bg-red-100" },
};

const statusColors = {
  todo: "bg-slate-200 text-slate-700",
  in_progress: "bg-blue-200 text-blue-700",
  in_review: "bg-purple-200 text-purple-700",
  done: "bg-green-200 text-green-700",
  archived: "bg-gray-200 text-gray-700",
};

export function KanbanView({ projectId, boards, tasks, searchQuery }: KanbanViewProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newBoardName, setNewBoardName] = useState("");
  const [newTaskData, setNewTaskData] = useState({
    title: "",
    description: "",
    priority: "medium" as const,
    boardId: "",
  });
  const [isBoardDialogOpen, setIsBoardDialogOpen] = useState(false);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const createBoardMutation = useMutation({
    mutationFn: (name: string) =>
      api.boards.create({
        name,
        projectId,
        position: boards.length,
        color: "#6366f1",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards"] });
      setNewBoardName("");
      setIsBoardDialogOpen(false);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: typeof newTaskData) =>
      api.tasks.create({
        ...data,
        projectId,
        createdBy: user?.id || "demo-user",
        position: tasks.filter((t) => t.boardId === data.boardId).length,
        status: "todo",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskData({ title: "", description: "", priority: "medium", boardId: "" });
      setIsTaskDialogOpen(false);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTask }) =>
      api.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData("taskId", task.id);
  };

  const handleDrop = (e: React.DragEvent, boardId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.boardId !== boardId) {
      updateTaskMutation.mutate({
        id: taskId,
        data: { boardId },
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (boards.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">No boards yet. Create your first board!</p>
          <Dialog open={isBoardDialogOpen} onOpenChange={setIsBoardDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Board
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Board</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Board Name</Label>
                  <Input
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    placeholder="e.g., To Do, In Progress, Done"
                  />
                </div>
                <Button
                  onClick={() => createBoardMutation.mutate(newBoardName)}
                  disabled={!newBoardName}
                  className="w-full"
                >
                  Create Board
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4">
      {boards.map((board) => {
        const boardTasks = filteredTasks.filter((task) => task.boardId === board.id);

        return (
          <div
            key={board.id}
            className="flex-shrink-0 w-80 bg-slate-50 rounded-lg p-4"
            onDrop={(e) => handleDrop(e, board.id)}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{board.name}</h3>
                <Badge variant="secondary" className="text-xs">
                  {boardTasks.length}
                </Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3 mb-3">
              {boardTasks.map((task) => {
                const PriorityIcon = priorityConfig[task.priority || "medium"].icon;
                return (
                  <Card
                    key={task.id}
                    className="p-3 cursor-move hover:shadow-md transition-shadow bg-white"
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-slate-900">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                            priorityConfig[task.priority || "medium"].bg
                          }`}
                        >
                          <PriorityIcon
                            className={`w-3 h-3 ${
                              priorityConfig[task.priority || "medium"].color
                            }`}
                          />
                          <span className="text-xs font-medium capitalize">
                            {task.priority}
                          </span>
                        </div>
                        {task.dueDate && (
                          <span className="text-xs text-slate-400">
                            {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Dialog
              open={isTaskDialogOpen && newTaskData.boardId === board.id}
              onOpenChange={(open) => {
                setIsTaskDialogOpen(open);
                if (!open) {
                  setNewTaskData({ title: "", description: "", priority: "medium", boardId: "" });
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-slate-500 hover:text-slate-900"
                  onClick={() => setNewTaskData({ ...newTaskData, boardId: board.id })}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={newTaskData.title}
                      onChange={(e) =>
                        setNewTaskData({ ...newTaskData, title: e.target.value })
                      }
                      placeholder="Task title"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newTaskData.description}
                      onChange={(e) =>
                        setNewTaskData({ ...newTaskData, description: e.target.value })
                      }
                      placeholder="Task description"
                    />
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={newTaskData.priority}
                      onValueChange={(value: any) =>
                        setNewTaskData({ ...newTaskData, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => createTaskMutation.mutate(newTaskData)}
                    disabled={!newTaskData.title}
                    className="w-full"
                  >
                    Create Task
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );
      })}

      <Dialog open={isBoardDialogOpen} onOpenChange={setIsBoardDialogOpen}>
        <DialogTrigger asChild>
          <button className="flex-shrink-0 w-80 h-fit bg-slate-100 rounded-lg p-4 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
            <Plus className="w-5 h-5 mr-2" />
            Add Board
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Board Name</Label>
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="e.g., To Do, In Progress, Done"
              />
            </div>
            <Button
              onClick={() => createBoardMutation.mutate(newBoardName)}
              disabled={!newBoardName}
              className="w-full"
            >
              Create Board
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
