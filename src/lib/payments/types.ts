/**
 * Unified Payment and Reconciliation Types
 * Defines data structures for the Multi-Dimensional Convergence Scoring Engine,
 * active checkout sessions, and incoming PayHook/UPI signals.
 */

export interface MultiDimensionalMatch {
  utr: string;
  amount: number;
  payerName?: string;
  source: string;
  score: number;
  matchedDimensionsCount: number;
  matchedDimensions: string[];
  confidence: number; // percentage (0 - 100)
  isEligibleForAutoApproval: boolean;
  timeDeltaSeconds?: number;
}

export interface PaymentCandidateSignal {
  orderId?: string;
  registrationId?: string;
  matchedOrderId?: string;
  matchedRegistrationId?: string;
  utr?: string;
  submittedUtr?: string;
  amount: number;
  receivedAmount?: number;
  payerName?: string;
  phone?: string;
  timestamp?: string;
  source: string;
}

export interface RegistrationForMatching {
  id: string;
  registrationId?: string;
  orderId?: string;
  paymentId?: string;
  amountPaid?: number;
  participantName?: string;
  leaderName?: string;
  phone?: string;
  registeredAt?: string;
  createdAt?: string | Date | { seconds: number; nanoseconds?: number } | any;
}

export interface DimensionEvaluation {
  name: string;
  matched: boolean;
  scoreAwarded: number;
  detail?: string;
}
