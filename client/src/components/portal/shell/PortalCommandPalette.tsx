import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Plus, Search, LogOut } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { PortalNavGroup } from "./portalNav";

interface Props {
  groups: PortalNavGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}

/** ⌘K / Ctrl+K jump box over every page the user is allowed to see. */
export function PortalCommandPalette({ groups, open, onOpenChange, onSignOut }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    if (href.startsWith("/portal")) navigate(href);
    else window.location.assign(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="sr-only">Search the portal</DialogTitle>
      <DialogDescription className="sr-only">Find a page or choose an action. Use the arrow keys to move through results.</DialogDescription>
      <CommandInput placeholder="Jump to a page or start an action…" value={query} onValueChange={setQuery} aria-label="Search the portal" className="min-w-0 focus-visible:outline-offset-[-2px]" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty role="option" aria-disabled="true" aria-selected="false">Nothing matches. Try a page name like “invoices”.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem value="new ticket create support" onSelect={() => go("/portal/tickets/create")}>
            <Plus aria-hidden="true" />
            <span>New support ticket</span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem value="search knowledge base articles" onSelect={() => go("/portal/kb")}>
            <Search aria-hidden="true" />
            <span>Search the knowledge base</span>
          </CommandItem>
        </CommandGroup>
        {groups.map((group) => (
          <CommandGroup key={group.id} heading={group.label}>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} value={`${item.label} ${item.hint ?? ""} ${group.label}`} onSelect={() => go(item.href)}>
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.hint && <span className="ml-2 truncate text-xs text-muted-foreground">{item.hint}</span>}
                  {item.sample && <CommandShortcut>sample</CommandShortcut>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
        <CommandSeparator aria-hidden="true" />
        <CommandGroup heading="Session">
          <CommandItem value="sign out log out" onSelect={() => { onOpenChange(false); onSignOut(); }}>
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
