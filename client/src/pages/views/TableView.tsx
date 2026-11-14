import React from "react";
import type { Board, Task, UpdateTask } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Circle, AlertCircle, ArrowUp } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface TableViewProps {
  projectId: string;
  boards: Board[];
  tasks: Task[];
  searchQuery: string;
}

const priorityConfig = {
  low: { icon: Circle, color: "text-slate-400", label: "Low" },
  medium: { icon: Circle, color: "text-blue-500", label: "Medium" },
  high: { icon: AlertCircle, color: "text-orange-500", label: "High" },
  urgent: { icon: ArrowUp, color: "text-red-500", label: "Urgent" },
};

const statusColors = {
  todo: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  in_review: "bg-purple-100 text-purple-700",
  done: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-700",
};

export function TableView({ projectId, boards, tasks, searchQuery }: TableViewProps) {
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTask }) =>
      api.tasks.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const filteredTasks = tasks
    .filter((task) => task.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getBoardName = (boardId: string | null) => {
    if (!boardId) return "Unassigned";
    return boards.find((b) => b.id === boardId)?.name || "Unknown";
  };

  const handleToggleComplete = (task: Task) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { status: task.status === "done" ? "todo" : "done" },
    });
  };

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>
          {searchQuery
            ? `No tasks found matching "${searchQuery}"`
            : "No tasks yet. Create your first task!"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead className="w-[40%]">Task</TableHead>
            <TableHead>Board</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTasks.map((task) => {
            const PriorityIcon = priorityConfig[task.priority || "medium"].icon;
            
            return (
              <TableRow key={task.id} className="hover:bg-slate-50">
                <TableCell>
                  <Checkbox
                    checked={task.status === "done"}
                    onCheckedChange={() => handleToggleComplete(task)}
                  />
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className={`font-medium ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-sm text-slate-500 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getBoardName(task.boardId)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[task.status]}>
                    {task.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className={`flex items-center gap-1 ${priorityConfig[task.priority || "medium"].color}`}>
                    <PriorityIcon className="w-4 h-4" />
                    <span className="text-sm">
                      {priorityConfig[task.priority || "medium"].label}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.dueDate ? (
                    <span className="text-sm">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-slate-500">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
