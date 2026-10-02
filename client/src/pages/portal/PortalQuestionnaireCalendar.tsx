import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PortalLayout } from "./PortalLayout";
import { Calendar, CheckCircle, AlertCircle, Clock, FileText, CheckSquare, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Callout, EmptyState, Panel, Token, type TokenTone } from "@/components/portal/ui";

interface CalendarEvent {
  id: string;
  date: Date;
  type: "deployment" | "project" | "tbr" | "cyber-assessment" | "site-assessment" | "risk-assessment" | "questionnaire";
  title: string;
  description: string;
  status: "scheduled" | "in-progress" | "completed";
  dueDate?: Date;
}

/** Colour carries the event family; the label and icon always travel with it. */
const eventTypeConfig: Record<CalendarEvent["type"], { label: string; tone: TokenTone; toneClass: string; icon: string }> = {
  deployment: { label: "Deployment", tone: "info", toneClass: "pt-tone-info", icon: "🚀" },
  project: { label: "Project", tone: "neutral", toneClass: "", icon: "📋" },
  tbr: { label: "Technology Business Review", tone: "brand", toneClass: "pt-tone-brand", icon: "📊" },
  "cyber-assessment": { label: "Cyber Assessment", tone: "bad", toneClass: "pt-tone-bad", icon: "🔐" },
  "site-assessment": { label: "Site Assessment", tone: "ok", toneClass: "pt-tone-ok", icon: "🏢" },
  "risk-assessment": { label: "Cyber Risk Assessment", tone: "warn", toneClass: "pt-tone-warn", icon: "⚠️" },
  questionnaire: { label: "Questionnaire", tone: "brand", toneClass: "pt-tone-brand", icon: "📝" },
};

const STATUS: Record<CalendarEvent["status"], { label: string; tone: TokenTone; Icon: typeof Clock }> = {
  scheduled: { label: "Scheduled", tone: "neutral", Icon: Clock },
  "in-progress": { label: "In progress", tone: "info", Icon: AlertCircle },
  completed: { label: "Completed", tone: "ok", Icon: CheckCircle },
};

const FILTERS: { value: "all" | CalendarEvent["status"]; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

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

function StatusToken({ status }: { status: CalendarEvent["status"] }) {
  const s = STATUS[status];
  return <Token label={s.label} tone={s.tone} dot />;
}

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

  return (
    <PortalLayout title="DE Questionnaires & Calendar" description="Important dates, assessments, and questionnaires">
      <div className="space-y-4">
        <Callout tone="warn" title="Sample preview." testId="questionnaire-sample-banner">
          Events below are illustrative until your live assessment calendar is connected.
        </Callout>

        <Tabs defaultValue="calendar" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4 space-y-4">
            <div role="group" aria-label="Filter by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
              {FILTERS.map((f) => {
                const active = filterStatus === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilterStatus(f.value)}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    data-testid={`button-filter-${f.value}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <Panel
              id="calendar-grid"
              title={format(currentDate, "MMMM yyyy")}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-card hover:bg-accent"
                    aria-label="Previous month"
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                    data-testid="button-prev-month"
                  >
                    ←
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-card hover:bg-accent"
                    onClick={() => setCurrentDate(new Date())}
                    data-testid="button-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-card hover:bg-accent"
                    aria-label="Next month"
                    onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                    data-testid="button-next-month"
                  >
                    →
                  </Button>
                </>
              }
            >
              <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="p-1 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:p-2">
                    {day}
                  </div>
                ))}

                {days.map((day, idx) => {
                  const dayEvents = getEventsForDate(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "min-h-20 rounded-lg border p-1.5 md:min-h-24 md:p-2",
                        isCurrentMonth ? "border-border bg-background" : "border-border bg-muted opacity-60",
                      )}
                      data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                    >
                      <div className="pt-num mb-1 text-sm font-semibold">
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 2).map((event) => {
                          const config = eventTypeConfig[event.type];
                          return (
                            <button
                              key={event.id}
                              type="button"
                              className={cn(
                                "block w-full rounded border px-1 py-0.5 text-left text-xs transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                config.tone === "neutral" ? "border-border bg-secondary text-foreground" : cn("pt-token", config.toneClass),
                              )}
                              onClick={() => setSelectedEvent(event)}
                              data-testid={`event-${event.id}`}
                            >
                              <span className="block truncate font-medium">{config.icon} {event.title}</span>
                            </button>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="px-1 text-xs text-muted-foreground">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel id="event-types" title="Event types">
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {(Object.keys(eventTypeConfig) as CalendarEvent["type"][]).map((key) => {
                  const config = eventTypeConfig[key];
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 rounded-sm border",
                          config.tone === "neutral" ? "border-border bg-secondary" : cn("pt-token", config.toneClass),
                        )}
                        aria-hidden="true"
                      />
                      <span>{config.icon} {config.label}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Panel id="timeline" title="Timeline" description={`${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"}`} flush>
              {filteredEvents.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="No events found for the selected filter."
                  description="Try another status."
                  action={
                    <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setFilterStatus("all")}>
                      Show all events
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {filteredEvents
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .map((event) => {
                      const config = eventTypeConfig[event.type];
                      return (
                        <li key={event.id} data-testid={`timeline-event-${event.id}`}>
                          <button
                            type="button"
                            onClick={() => setSelectedEvent(event)}
                            className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:px-5"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="text-2xl leading-none" aria-hidden="true">{config.icon}</div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-medium">{event.title}</h3>
                                  <StatusToken status={event.status} />
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                                <div className="pt-num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span>📅 {format(event.date, "MMM dd, yyyy")}</span>
                                  {event.dueDate && (
                                    <span>⏰ Due: {format(event.dueDate, "MMM dd, yyyy")}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Token label={config.label} tone={config.tone} className="hidden shrink-0 sm:inline-flex" />
                          </button>
                        </li>
                      );
                    })}
                </ul>
              )}
            </Panel>
          </TabsContent>
        </Tabs>

        {selectedEvent && (
          <Panel
            id="event-details"
            title={<span>{eventTypeConfig[selectedEvent.type].icon} {selectedEvent.title}</span>}
            description={eventTypeConfig[selectedEvent.type].label}
            actions={
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground"
                aria-label="Close details"
                onClick={() => setSelectedEvent(null)}
                data-testid="button-close-details"
              >
                <X aria-hidden="true" />
              </Button>
            }
          >
            <div className="space-y-4">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="mt-0.5 font-medium">{selectedEvent.description}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="pt-num mt-0.5 font-medium">{format(selectedEvent.date, "MMMM dd, yyyy")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="mt-1"><StatusToken status={selectedEvent.status} /></dd>
                </div>
              </dl>

              {selectedEvent.type === "questionnaire" && (
                <Button variant="brand" className="w-full" data-testid="button-fill-questionnaire">
                  <FileText aria-hidden="true" />
                  Fill Out Questionnaire
                </Button>
              )}

              {selectedEvent.status === "scheduled" && selectedEvent.type !== "questionnaire" && (
                <Button variant="outline" className="w-full border-border bg-card hover:bg-accent" data-testid="button-prepare-event">
                  <CheckSquare aria-hidden="true" />
                  Mark as In Progress
                </Button>
              )}

              {selectedEvent.status === "in-progress" && (
                <Button variant="outline" className="w-full border-border bg-card hover:bg-accent" data-testid="button-complete-event">
                  <CheckCircle aria-hidden="true" />
                  Mark as Completed
                </Button>
              )}
            </div>
          </Panel>
        )}
      </div>
    </PortalLayout>
  );
}
