import { RegistrationRecord } from "@/types";

// Dynamic registrations store — zero hardcoded fake records.
// Real delegate registrations are populated dynamically via Firestore and local session storage.
export const mockRegistrations: RegistrationRecord[] = [];
