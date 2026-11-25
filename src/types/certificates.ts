export type CertificateType =
  | "PARTICIPATION"
  | "ACHIEVEMENT";

export type CertificateStatus = "PUBLISHED" | "REVOKED";

export interface CertificateSignatory {
  id: string;
  name: string;
  designation: string; // e.g. "President, SRC", "Faculty Coordinator", "Dean IQAC"
  organization?: string; // e.g. "Session 2026-27", "SRC, JDCOEM", "JDCOEM Nagpur"
  signatureImageUrl?: string; // Transparent PNG of signature
}

export interface CertificateColorPalette {
  primary: string; // Dominant dark accent (e.g. #0B2545, #1E3A8A, #3B1D6E)
  secondary: string; // Secondary wave/gradient hue (e.g. #1E40AF, #6D28D9)
  accent: string; // Bright ribbon/glow accent (e.g. #38BDF8, #A78BFA, #F59E0B)
  pillBg: string; // Dark contrast background for the category pill (e.g. #0F172A)
  pillText: string; // Text color inside pill (e.g. #FFFFFF)
  borderGlow?: string;
}

export interface CertificateRecord {
  id: string; // Unique ID e.g. "cert_prrm_reg123"
  certificateNumber: string; // Formatted credential serial e.g. "SRC/2025-26/PRRM-8924"
  type: CertificateType;
  title: string; // e.g. "CERTIFICATE OF PARTICIPATION"

  // Recipient details
  recipientName: string;
  recipientEmail: string;
  recipientBtId?: string;
  recipientDepartment?: string;
  recipientYear?: string;
  recipientCollege?: string;
  registrationId?: string;
  ticketCode?: string;

  // Event details
  eventId: string;
  eventSlug: string;
  eventName: string;
  eventDate?: string;
  organizerClub?: string;
  organizerClubSlug?: string;
  clubLogoUrl?: string;
  posterUrl?: string;
  tenureId?: string;

  // Visual styling (extracted from 4:5 poster)
  colorPalette: CertificateColorPalette;

  // Recognition content
  rankOrPosition?: string; // e.g. "1st Place", "Winner"
  citation: string;
  signatories: CertificateSignatory[];

  // Verification & Metadata
  issueDate: string; // YYYY-MM-DD
  status: CertificateStatus;
  issuanceMode?: "MANUAL" | "AUTOMATED";
  verificationUrl: string;
  qrPayload: string;
  issuedBy: string; // Admin UID or Name
  issuedAt: string; // ISO timestamp
  revokedAt?: string;
  revocationReason?: string;
}

export interface CertificateSettings {
  defaultSignatories: CertificateSignatory[];
  defaultCitationTemplate: string;
  defaultClubLogoUrl?: string;
  clubLogosByEvent?: Record<string, string>;
  updatedAt?: string;
  updatedBy?: string;
}
