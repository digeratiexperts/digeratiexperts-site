import React from "react";
import type { Board, Task, UpdateTask } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Circle, AlertCircle, ArrowUp, Calendar, User } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

interface ListViewProps {
  projectId: string;
  boards: Board[];
  tasks: Task[];
  searchQuery: string;
}

const priorityConfig = {
  low: { icon: Circle, color: "text-slate-400" },
  medium: { icon: Circle, color: "text-blue-500" },
  high: { icon: AlertCircle, color: "text-orange-500" },
  urgent: { icon: ArrowUp, color: "text-red-500" },
};

export function ListView({ projectId, boards, tasks, searchQuery }: ListViewProps) {
  const queryClient = useQueryClient();

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

  const groupedTasks = boards.reduce((acc, board) => {
    acc[board.id] = filteredTasks.filter((task) => task.boardId === board.id);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleToggleComplete = (task: Task) => {
    updateTaskMutation.mutate({
      id: task.id,
      data: { status: task.status === "done" ? "todo" : "done" },
    });
  };

  return (
    <div className="space-y-6">
      {boards.map((board) => {
        const boardTasks = groupedTasks[board.id] || [];
        
        if (boardTasks.length === 0 && searchQuery) return null;

        return (
          <div key={board.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-slate-900">{board.name}</h3>
              <Badge variant="secondary">{boardTasks.length}</Badge>
            </div>

            <div className="space-y-2">
              {boardTasks.length === 0 ? (
                <Card className="p-4 text-center text-slate-400">
                  No tasks in this board
                </Card>
              ) : (
                boardTasks.map((task) => {
                  const PriorityIcon = priorityConfig[task.priority || "medium"].icon;
                  
                  return (
                    <Card
                      key={task.id}
                      className="p-4 hover:shadow-md transition-shadow cursor-pointer bg-white"
                    >
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={task.status === "done"}
                          onCheckedChange={() => handleToggleComplete(task)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className={`font-medium ${task.status === "done" ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center gap-1 ${priorityConfig[task.priority || "medium"].color}`}>
                                <PriorityIcon className="w-4 h-4" />
                                <span className="text-xs font-medium capitalize">
                                  {task.priority}
                                </span>
                              </div>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-sm text-slate-500">{task.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            {task.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}
                            {task.assigneeId && (
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                Assigned
                              </div>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        );
      })}

      {filteredTasks.length === 0 && searchQuery && (
        <div className="text-center py-12 text-slate-400">
          <p>No tasks found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}
