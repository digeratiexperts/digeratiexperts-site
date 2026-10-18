/** Client-safe company projection. Internal lifecycle, mappings and auth fields never cross this boundary. */
export type PortalCompanyProfile = {
  status: "ready" | "choose_company" | "company_unlinked" | "company_unavailable";
  canChooseCompany: boolean;
  company: { id: string; name: string; email: string; phone: string; industry: string } | null;
  team: Array<{ id: string; name: string; email: string; isItContact: boolean }>;
};
