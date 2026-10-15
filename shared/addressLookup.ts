/**
 * One address suggestion from GET /api/address/suggest (server/addressLookup.ts).
 * `state` is the short code where one exists ("AZ"), `stateName` the full name; `country` is ISO 3166-1 alpha-2, upper case.
 */
export interface AddressSuggestion {
  label: string;
  line1: string;
  city: string;
  state: string;
  /** Full state / province name ("Arizona"), for forms that pick from a name list. */
  stateName: string;
  postalCode: string;
  country: string;
  /** False when the match is a street only, so the person still has to type the number. */
  hasHouseNumber: boolean;
}

export interface AddressSuggestResponse {
  enabled: boolean;
  suggestions: AddressSuggestion[];
  unavailable?: boolean;
}
