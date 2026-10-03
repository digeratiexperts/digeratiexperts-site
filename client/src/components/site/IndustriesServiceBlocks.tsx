import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { cn } from "@/lib/utils";
import { CheckList, bodyClass, inkClass, type ChapterTone } from "@/components/site/chapters";

export type ServiceBlock = {
  icon?: LucideIcon;
  title: string;
  desc?: string;
  features: ReactNode[];
};

/**
 * Industries group: service blocks that each carry a short check list.
 * Hairline-topped columns instead of boxed cards, so a long list of services
 * reads as one considered chapter. Used by the industry pages.
 */
export function ServiceBlocks({
  items,
  tone,
  columns = 2,
}: {
  items: ServiceBlock[];
  tone: ChapterTone;
  columns?: 2 | 3;
}) {
  const seam = tone === "paper" ? "border-[var(--de-paper-hairline)]" : "border-[var(--de-hairline)]";
  return (
    <ul className={cn("grid gap-x-14 gap-y-12", columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((s) => (
        <li key={s.title} className={cn("border-t pt-7", seam)}>
          <div className="flex items-start gap-4">
            {s.icon && <IconWell icon={s.icon} surface={tone === "paper" ? "light" : "dark"} className="shrink-0" />}
            <div>
              <h3 className={cn("font-heading text-xl font-semibold leading-snug", inkClass(tone))}>{s.title}</h3>
              {s.desc && <p className={cn("mt-1 text-sm", bodyClass(tone))}>{s.desc}</p>}
            </div>
          </div>
          <div className="mt-6">
            <CheckList tone={tone} items={s.features} columns={1} />
          </div>
        </li>
      ))}
    </ul>
  );
}
