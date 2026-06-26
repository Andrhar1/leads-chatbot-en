export const INDUSTRIES = [
  "Manufacturing", "Real Estate", "Fintech/Finance", "F&B", "Healthcare",
  "Technology", "Energy", "Retail", "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const LEGAL_NEEDS = [
  "Corporate/M&A", "Litigation", "Employment", "Intellectual Property",
  "Licensing/Regulatory", "Contracts", "Other",
] as const;
export type LegalNeed = (typeof LEGAL_NEEDS)[number];

export type LeadStatus = "new" | "collecting" | "ready_for_handover" | "handed_over";

export interface Lead {
  id: number;
  waChatId: string;
  personName: string | null;
  companyName: string | null;
  industry: Industry | null;
  legalNeed: LegalNeed | null;
  status: LeadStatus;
  confidence: number | null;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: number;
  leadId: number;
  direction: "in" | "out";
  body: string;
  createdAt: string;
}

export interface Classification {
  industry: Industry | null;
  legalNeed: LegalNeed | null;
  personName: string | null;
  companyName: string | null;
  confidence: number;
}
