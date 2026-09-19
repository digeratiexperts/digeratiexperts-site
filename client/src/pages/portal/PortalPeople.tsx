import { useEffect, useState } from "react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canManageOrg, readPortalUser } from "@/lib/portalRoles";
import { Link } from "wouter";

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

export function PortalPeople() {
  const user = readPortalUser();
  const allowed = canManageOrg(user);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const token = () => localStorage.getItem("portalToken") || "";

  const load = async () => {
    setError(null);
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
      <PortalLayout title="People & Org">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-slate-600">
              Only your Company IT Contact (or a Digerati admin) can manage managers, departments, and
              IT Contacts.
            </p>
            <Link
              href="/portal/tickets"
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm"
            >
              Go to Support Tickets
            </Link>
          </CardContent>
        </Card>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="People & Org">
      <div className="max-w-5xl mx-auto space-y-6">
        <p className="text-sm text-slate-600">
          Assign each person a manager (boss), optional department, and designate the Company IT Contact
          who owns day-to-day communication with Digerati. Department IT Contacts are optional.
        </p>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-2">
              {departments.length === 0 && (
                <li className="text-slate-500">No departments yet — optional for smaller companies.</li>
              )}
              {departments.map((d) => (
                <li key={d.id} className="flex justify-between border rounded px-3 py-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-slate-500">
                    IT Contact:{" "}
                    {people.find((p) => p.id === d.itContactUserId)?.fullName || "Not set"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="New department name"
                aria-label="New department name"
              />
              <Button onClick={addDepartment}>Add department</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {people.map((person) => (
              <div key={person.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-semibold">{person.fullName}</p>
                  <p className="text-sm text-slate-500">{person.email}</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <Label>Org role</Label>
                    <Select
                      value={person.orgRole || "staff"}
                      onValueChange={(orgRole) => savePerson(person, { orgRole })}
                      disabled={savingId === person.id}
                    >
                      <SelectTrigger aria-label={`Role for ${person.fullName}`}>
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
                  <div>
                    <Label>Manager (boss)</Label>
                    <Select
                      value={person.managerUserId || "none"}
                      onValueChange={(v) =>
                        savePerson(person, { managerUserId: v === "none" ? null : v })
                      }
                      disabled={savingId === person.id}
                    >
                      <SelectTrigger aria-label={`Manager for ${person.fullName}`}>
                        <SelectValue placeholder="Select manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No manager</SelectItem>
                        {people
                          .filter((p) => p.id !== person.id)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select
                      value={person.departmentId || "none"}
                      onValueChange={(v) =>
                        savePerson(person, { departmentId: v === "none" ? null : v })
                      }
                      disabled={savingId === person.id}
                    >
                      <SelectTrigger aria-label={`Department for ${person.fullName}`}>
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
                  <div className="flex items-end">
                    <Button
                      variant={person.isCompanyItContact ? "default" : "outline"}
                      className="w-full"
                      disabled={savingId === person.id}
                      onClick={() =>
                        savePerson(person, {
                          isCompanyItContact: !person.isCompanyItContact,
                          orgRole: !person.isCompanyItContact
                            ? "company_it_contact"
                            : person.orgRole === "company_it_contact"
                              ? "staff"
                              : person.orgRole,
                        })
                      }
                    >
                      {person.isCompanyItContact ? "Company IT Contact" : "Make Company IT Contact"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

export default PortalPeople;
