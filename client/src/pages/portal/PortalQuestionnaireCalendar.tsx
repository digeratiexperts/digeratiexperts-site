import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalLayout } from "./PortalLayout";
import { Calendar, CheckCircle, AlertCircle, Clock, FileText, CheckSquare } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";

interface CalendarEvent {
  id: string;
  date: Date;
  type: "deployment" | "project" | "tbr" | "cyber-assessment" | "site-assessment" | "risk-assessment" | "questionnaire";
  title: string;
  description: string;
  status: "scheduled" | "in-progress" | "completed";
  dueDate?: Date;
}

const eventTypeConfig = {
  deployment: {
    label: "Deployment",
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200",
    icon: "🚀",
  },
  project: {
    label: "Project",
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200",
    icon: "📋",
  },
  tbr: {
    label: "Technology Business Review",
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-900 dark:text-orange-200",
    icon: "📊",
  },
  "cyber-assessment": {
    label: "Cyber Assessment",
    color: "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200",
    icon: "🔐",
  },
  "site-assessment": {
    label: "Site Assessment",
    color: "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200",
    icon: "🏢",
  },
  "risk-assessment": {
    label: "Cyber Risk Assessment",
    color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200",
    icon: "⚠️",
  },
  questionnaire: {
    label: "Questionnaire",
    color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-200",
    icon: "📝",
  },
};

const mockEvents: CalendarEvent[] = [
  {
    id: "1",
    date: new Date(2025, 10, 25),
    type: "deployment",
    title: "Q4 Security Update Deployment",
    description: "Deploy latest security patches and firewall updates",
    status: "scheduled",
    dueDate: new Date(2025, 10, 25),
  },
  {
    id: "2",
    date: new Date(2025, 11, 5),
    type: "tbr",
    title: "Q4 Technology Business Review",
    description: "Quarterly review of IT infrastructure and strategic planning",
    status: "scheduled",
    dueDate: new Date(2025, 11, 5),
  },
  {
    id: "3",
    date: new Date(2025, 11, 10),
    type: "cyber-assessment",
    title: "Annual Cyber Security Assessment",
    description: "Comprehensive cybersecurity posture evaluation",
    status: "in-progress",
    dueDate: new Date(2025, 11, 10),
  },
  {
    id: "4",
    date: new Date(2025, 11, 15),
    type: "questionnaire",
    title: "DE Security Questionnaire - Annual",
    description: "Complete annual security and compliance questionnaire",
    status: "scheduled",
    dueDate: new Date(2025, 11, 20),
  },
  {
    id: "5",
    date: new Date(2025, 11, 1),
    type: "project",
    title: "Network Infrastructure Upgrade",
    description: "Upgrade network switches and routing equipment",
    status: "in-progress",
    dueDate: new Date(2025, 11, 15),
  },
  {
    id: "6",
    date: new Date(2025, 10, 28),
    type: "site-assessment",
    title: "Physical Site Security Assessment",
    description: "On-site evaluation of security measures",
    status: "scheduled",
    dueDate: new Date(2025, 10, 28),
  },
  {
    id: "7",
    date: new Date(2025, 11, 18),
    type: "risk-assessment",
    title: "Cyber Risk Assessment - Vendor Review",
    description: "Evaluate security of third-party vendors",
    status: "scheduled",
    dueDate: new Date(2025, 11, 25),
  },
];

export function PortalQuestionnaireCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 10));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "scheduled" | "in-progress" | "completed">("all");

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const filteredEvents =
    filterStatus === "all" ? mockEvents : mockEvents.filter((e) => e.status === filterStatus);

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter((event) => isSameDay(event.date, date));
  };

  const statusIcon = {
    scheduled: <Clock className="w-4 h-4" />,
    "in-progress": <AlertCircle className="w-4 h-4" />,
    completed: <CheckCircle className="w-4 h-4" />,
  };

  return (
    <PortalLayout title="DE Questionnaires & Calendar">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">DE Questionnaires & Calendar</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Important dates, assessments, and questionnaires
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="questionnaire-sample-banner"
        >
          <strong>Sample preview.</strong> Events below are illustrative until your live assessment calendar is connected.
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            {/* Filter */}
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                data-testid="button-filter-all"
              >
                All Events
              </Button>
              <Button
                variant={filterStatus === "scheduled" ? "default" : "outline"}
                onClick={() => setFilterStatus("scheduled")}
                data-testid="button-filter-scheduled"
              >
                Scheduled
              </Button>
              <Button
                variant={filterStatus === "in-progress" ? "default" : "outline"}
                onClick={() => setFilterStatus("in-progress")}
                data-testid="button-filter-in-progress"
              >
                In Progress
              </Button>
              <Button
                variant={filterStatus === "completed" ? "default" : "outline"}
                onClick={() => setFilterStatus("completed")}
                data-testid="button-filter-completed"
              >
                Completed
              </Button>
            </div>

            {/* Calendar Grid */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                      data-testid="button-prev-month"
                    >
                      ←
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date())}
                      data-testid="button-today"
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                      data-testid="button-next-month"
                    >
                      →
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headers */}
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center font-semibold text-sm text-gray-600 dark:text-gray-400 p-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {days.map((day, idx) => {
                    const dayEvents = getEventsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);

                    return (
                      <div
                        key={idx}
                        className={`min-h-24 p-2 border rounded-lg ${
                          isCurrentMonth
                            ? "bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700"
                            : "bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-gray-700 opacity-50"
                        }`}
                        data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                      >
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          {format(day, "d")}
                        </div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 2).map((event) => {
                            const config = eventTypeConfig[event.type];
                            return (
                              <div
                                key={event.id}
                                className={`text-xs p-1 rounded cursor-pointer ${config.color} hover:opacity-80 transition-opacity`}
                                onClick={() => setSelectedEvent(event)}
                                data-testid={`event-${event.id}`}
                              >
                                <div className="truncate font-medium">{config.icon} {event.title}</div>
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${config.color}`}></div>
                      <span className="text-sm">{config.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="space-y-3">
              {filteredEvents
                .sort((a, b) => a.date.getTime() - b.date.getTime())
                .map((event) => {
                  const config = eventTypeConfig[event.type];
                  const statusConfig = statusIcon[event.status as keyof typeof statusIcon];

                  return (
                    <Card
                      key={event.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedEvent(event)}
                      data-testid={`timeline-event-${event.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="text-2xl">{config.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{event.title}</h3>
                                <Badge
                                  variant={
                                    event.status === "completed"
                                      ? "default"
                                      : event.status === "in-progress"
                                        ? "secondary"
                                        : "outline"
                                  }
                                  className="flex items-center gap-1"
                                >
                                  {statusConfig}
                                  {event.status === "in-progress" ? "In Progress" : event.status === "completed" ? "Completed" : "Scheduled"}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{event.description}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                                <span>📅 {format(event.date, "MMM dd, yyyy")}</span>
                                {event.dueDate && (
                                  <span>⏰ Due: {format(event.dueDate, "MMM dd, yyyy")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge className={config.color}>{config.label}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

              {filteredEvents.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center text-gray-600 dark:text-gray-400">
                    No events found for the selected filter.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Event Details Panel */}
        {selectedEvent && (
          <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span>{eventTypeConfig[selectedEvent.type].icon}</span>
                    {selectedEvent.title}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {eventTypeConfig[selectedEvent.type].label}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedEvent(null)}
                  data-testid="button-close-details"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Description</h4>
                <p className="text-gray-600 dark:text-gray-400">{selectedEvent.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Date</h4>
                  <p className="text-gray-600 dark:text-gray-400">{format(selectedEvent.date, "MMMM dd, yyyy")}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Status</h4>
                  <Badge
                    variant={
                      selectedEvent.status === "completed"
                        ? "default"
                        : selectedEvent.status === "in-progress"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {selectedEvent.status === "in-progress"
                      ? "In Progress"
                      : selectedEvent.status === "completed"
                        ? "Completed"
                        : "Scheduled"}
                  </Badge>
                </div>
              </div>

              {selectedEvent.type === "questionnaire" && (
                <Button className="w-full bg-[#D3126A] hover:bg-[#e01874]" data-testid="button-fill-questionnaire">
                  <FileText className="w-4 h-4 mr-2" />
                  Fill Out Questionnaire
                </Button>
              )}

              {selectedEvent.status === "scheduled" && selectedEvent.type !== "questionnaire" && (
                <Button className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-prepare-event">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Mark as In Progress
                </Button>
              )}

              {selectedEvent.status === "in-progress" && (
                <Button className="w-full bg-green-600 hover:bg-green-700" data-testid="button-complete-event">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark as Completed
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
