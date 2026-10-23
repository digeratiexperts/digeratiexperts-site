import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/portal/ui";
import { MY_QUESTIONNAIRES_KEY, questionnairesApi } from "@/lib/questionnairesApi";
import { formatDueDay } from "@shared/questionnaires";

/** Home task: questionnaires DE is waiting on from this person. Nothing when there are none. */
export function QuestionnaireTasks() {
  const q = useQuery({ queryKey: MY_QUESTIONNAIRES_KEY, queryFn: questionnairesApi.mine });
  const open = (q.data?.questionnaires ?? []).filter((x) => x.status === "assigned" || x.status === "draft");
  if (open.length === 0) return null;
  const overdue = open.filter((x) => x.overdue).length;
  const next = open[0];
  return (
    <Callout
      tone={overdue > 0 ? "warn" : "info"}
      title={open.length === 1 ? `DE is waiting on your answers: ${next.title}` : `DE is waiting on ${open.length} questionnaires from you`}
      testId="home-questionnaires"
      action={
        <Button asChild size="sm" variant="outline" className="border-border bg-card hover:bg-accent">
          <Link href={open.length === 1 ? `/portal/my-questionnaires?id=${encodeURIComponent(next.id)}` : "/portal/my-questionnaires"}>
            {open.length === 1 ? "Answer" : "Open"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        {overdue > 0 ? `${overdue} overdue. ` : ""}Next due {formatDueDay(next.dueOn)}.
      </span>
    </Callout>
  );
}
