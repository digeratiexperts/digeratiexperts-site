import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Building2, Lock, Users } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageOrg, readPortalUser } from "@/lib/portalRoles";
import { Callout, DataTable, EmptyState, Field, Panel, Token, type DataColumn } from "@/components/portal/ui";

type Person = {
  id: string;
  fullName: string;
  email: string;
  orgRole: string;
  departmentId?: string | null;
  managerUserId?: string | null;
  isCompanyItContact?: boolean;
};

type Department = {
  id: string;
  name: string;
  itContactUserId?: string | null;
};

/** Column label repeated inside the mobile card, where there is no table header. */
function CellLabel({ children }: { children: string }) {
  return <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground md:hidden">{children}</span>;
}

export function PortalPeople() {
  const user = readPortalUser();
  const allowed = canManageOrg(user);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const token = () => localStorage.getItem("portalToken") || "";

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/portal/org/people", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load people");
      setPeople(data.people || []);
      setDepartments(data.departments || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  const savePerson = async (person: Person, patch: Partial<Person>) => {
    setSavingId(person.id);
    try {
      const res = await fetch(`/api/portal/org/people/${person.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const addDepartment = async () => {
    if (!deptName.trim()) return;
    try {
      const res = await fetch("/api/portal/org/departments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: deptName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create department");
      setDeptName("");
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!allowed) {
    return (
      <PortalLayout title="People & Org" width="narrow">
        <Panel id="people-restricted" flush>
          <EmptyState
            icon={Lock}
            title="Restricted to your Company IT Contact"
            description="Only your Company IT Contact (or a Digerati admin) can manage managers, departments, and IT Contacts."
            action={
              <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
                <Link href="/portal/tickets">Go to Support Tickets</Link>
              </Button>
            }
          />
        </Panel>
      </PortalLayout>
    );
  }

  const departmentColumns: DataColumn<Department>[] = [
    { key: "name", header: "Department", primary: true, cell: (d) => <span className="font-medium">{d.name}</span> },
    {
      key: "itContact",
      header: "IT Contact",
      primary: true,
      cell: (d) => {
        const contact = people.find((p) => p.id === d.itContactUserId)?.fullName;
        return contact ? <span>{contact}</span> : <span className="text-muted-foreground">Not set</span>;
      },
    },
  ];

  const peopleColumns: DataColumn<Person>[] = [
    {
      key: "person",
      header: "Person",
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{p.fullName}</span>
            {p.isCompanyItContact && <Token label="Company IT Contact" tone="brand" className="px-1.5 py-0 text-[9px]" />}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.email}</p>
        </div>
      ),
    },
    {
      key: "orgRole",
      header: "Org role",
      primary: true,
      className: "w-44",
      cell: (p) => (
        <div className="min-w-[10rem]">
          <CellLabel>Org role</CellLabel>
          <Select value={p.orgRole || "staff"} onValueChange={(orgRole) => savePerson(p, { orgRole })} disabled={savingId === p.id}>
            <SelectTrigger aria-label={`Role for ${p.fullName}`} className="h-9 border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="dept_it_contact">Dept IT Contact</SelectItem>
              <SelectItem value="company_it_contact">Company IT Contact</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "manager",
      header: "Manager (boss)",
      primary: true,
      className: "w-48",
      cell: (p) => (
        <div className="min-w-[10rem]">
          <CellLabel>Manager (boss)</CellLabel>
          <Select
            value={p.managerUserId || "none"}
            onValueChange={(v) => savePerson(p, { managerUserId: v === "none" ? null : v })}
            disabled={savingId === p.id}
          >
            <SelectTrigger aria-label={`Manager for ${p.fullName}`} className="h-9 border-border bg-background">
              <SelectValue placeholder="Select manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No manager</SelectItem>
              {people
                .filter((other) => other.id !== p.id)
                .map((other) => (
                  <SelectItem key={other.id} value={other.id}>
                    {other.fullName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "department",
      header: "Department",
      primary: true,
      className: "w-44",
      cell: (p) => (
        <div className="min-w-[10rem]">
          <CellLabel>Department</CellLabel>
          <Select
            value={p.departmentId || "none"}
            onValueChange={(v) => savePerson(p, { departmentId: v === "none" ? null : v })}
            disabled={savingId === p.id}
          >
            <SelectTrigger aria-label={`Department for ${p.fullName}`} className="h-9 border-border bg-background">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
    },
    {
      key: "itContact",
      header: <span className="sr-only">Company IT Contact</span>,
      primary: true,
      align: "right",
      className: "w-56",
      cell: (p) => (
        <Button
          type="button"
          size="sm"
          variant={p.isCompanyItContact ? "brand" : "outline"}
          className={p.isCompanyItContact ? "" : "border-border bg-card hover:bg-accent"}
          aria-pressed={!!p.isCompanyItContact}
          disabled={savingId === p.id}
          onClick={() =>
            savePerson(p, {
              isCompanyItContact: !p.isCompanyItContact,
              orgRole: !p.isCompanyItContact
                ? "company_it_contact"
                : p.orgRole === "company_it_contact"
                  ? "staff"
                  : p.orgRole,
            })
          }
        >
          {p.isCompanyItContact ? "Company IT Contact" : "Make Company IT Contact"}
        </Button>
      ),
    },
  ];

  return (
    <PortalLayout
      title="People & Org"
      description="Assign each person a manager (boss), optional department, and designate the Company IT Contact who owns day-to-day communication with Digerati. Department IT Contacts are optional."
      width="wide"
    >
      <div className="space-y-4">
        {error && (
          <Callout tone="bad" title="Something went wrong">
            {error}
          </Callout>
        )}

        <Panel
          id="departments"
          title="Departments"
          description={loading ? "Loading…" : `${departments.length} department${departments.length === 1 ? "" : "s"}`}
          flush
        >
          <DataTable<Department>
            columns={departmentColumns}
            rows={departments}
            rowKey={(d) => d.id}
            loading={loading && departments.length === 0}
            loadingRows={2}
            caption="Departments"
            empty={<EmptyState compact icon={Building2} title="No departments yet" description="Optional for smaller companies. Add one below if it helps route approvals." />}
          />
          <form
            className="flex flex-col gap-3 border-t border-border bg-background/40 px-4 py-4 sm:flex-row sm:items-end md:px-5"
            onSubmit={(e) => {
              e.preventDefault();
              void addDepartment();
            }}
          >
            <Field label="New department name" htmlFor="new-department-name" className="flex-1">
              <Input
                id="new-department-name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="e.g. Finance"
                aria-label="New department name"
                className="border-border bg-card"
              />
            </Field>
            <Button type="submit" variant="brand">
              Add department
            </Button>
          </form>
        </Panel>

        <Panel
          id="people"
          title="People"
          description={loading ? "Loading…" : `${people.length} ${people.length === 1 ? "person" : "people"}`}
          flush
        >
          <DataTable<Person>
            columns={peopleColumns}
            rows={people}
            rowKey={(p) => p.id}
            loading={loading && people.length === 0}
            caption="People in your organization"
            empty={<EmptyState compact icon={Users} title="No people yet" description="Portal users at your company appear here once their accounts are created." />}
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}

export default PortalPeople;
