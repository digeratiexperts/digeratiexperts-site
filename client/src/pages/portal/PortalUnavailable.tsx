import { ArrowLeft, LifeBuoy, LockKeyhole } from "lucide-react";
import { Link } from "wouter";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PortalLayout } from "./PortalLayout";

type PortalUnavailableProps = {
  title: string;
  description: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export default function PortalUnavailable({
  title,
  description,
  secondaryHref = "/portal/dashboard",
  secondaryLabel = "Back to Dashboard",
}: PortalUnavailableProps) {
  return (
    <PortalLayout title={title}>
      <div className="mx-auto max-w-2xl py-8 md:py-16">
        <Card className="border-slate-200 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D3126A]/10 text-[#D3126A]">
                <LockKeyhole className="h-6 w-6" aria-hidden="true" />
              </div>
              <Badge variant="outline">Not connected</Badge>
            </div>
            <div>
              <CardTitle className="text-2xl">{title}</CardTitle>
              <CardDescription className="mt-2 text-base leading-relaxed">
                {description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row dark:border-white/10">
            <Link
              href="/portal/tickets/create"
              className={cn(buttonVariants(), "gap-2")}
              data-testid="link-open-support-request"
            >
              <LifeBuoy className="h-4 w-4" aria-hidden="true" />
              Open Support Request
            </Link>
            <Link
              href={secondaryHref}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {secondaryLabel}
            </Link>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
