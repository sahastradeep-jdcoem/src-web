import {
  MultiDimensionalMatch,
  PaymentCandidateSignal,
  RegistrationForMatching
} from "./types";
import { isNameCompatible } from "./textParser";

export const DIMENSION_WEIGHTS = {
  BANK_UTR: 45,
  ORDER_ID: 40,
  PASS_ID: 35,
  MICRO_PAISA_EXACT: 35,
  BASE_FEE_MATCH: 25,
  ROUND_AMOUNT_EXACT: 20,
  TIME_LE_3M: 30,
  TIME_LE_15M: 20,
  TIME_LE_45M: 10,
  STUDENT_NAME: 25,
  PHONE_NUMBER: 20,
} as const;

export const AUTO_APPROVE_CRITERIA = {
  MIN_DIMENSIONS: 2,
  MIN_SCORE: 60,
  MAX_SCORE_BASELINE: 120, // 120 pts = 100% confidence
} as const;

/**
 * Evaluates a single candidate payment signal against a student registration across all 7 dimensions.
 */
export function evaluateCandidateAgainstRegistration(
  cand: PaymentCandidateSignal,
  reg: RegistrationForMatching
): MultiDimensionalMatch | null {
  const regDocId = (reg.id || "").trim();
  const regTicketId = (reg.registrationId || reg.id || "").trim();
  const regOrderId = (reg.orderId || "").trim();
  const regPaymentId = (reg.paymentId || "").trim();
  const regAmt = Number(reg.amountPaid || 0);
  const regName = (reg.participantName || reg.leaderName || "").trim().toLowerCase();
  const regPhone = (reg.phone || "").replace(/\D/g, "").slice(-6);

  let regTimeMs = 0;
  if (reg.createdAt instanceof Date) {
    regTimeMs = reg.createdAt.getTime();
  } else if (typeof reg.createdAt === "object" && reg.createdAt && "seconds" in reg.createdAt) {
    regTimeMs = reg.createdAt.seconds * 1000;
  } else if (reg.registeredAt || reg.createdAt) {
    regTimeMs = new Date((reg.registeredAt || reg.createdAt) as string).getTime();
  }

  let score = 0;
  const matchedDims: string[] = [];
  const candAmount = cand.receivedAmount || cand.amount || 0;
  const candUtr = (cand.utr || cand.submittedUtr || "").trim();

  const candOrderId = (cand.orderId || cand.matchedOrderId || "").trim();
  const candRegId = (cand.registrationId || cand.matchedRegistrationId || "").trim();

  // Strict Invariant: If candidate is explicitly tied to another registration or order, DISQUALIFY
  if (candRegId && regDocId && candRegId !== regDocId && candRegId !== regTicketId) {
    return null;
  }
  if (candOrderId && regOrderId && candOrderId !== regOrderId) {
    return null;
  }

  // Strict Invariant: If candidate has a payer name that contradicts student name,
  // do not match unless there is an explicit Order ID or Pass ID link
  const candPayer = (cand.payerName || "").trim();
  if (candPayer && regName) {
    const isNameMatch = isNameCompatible(candPayer, regName);
    const hasExplicitIdLink = Boolean(
      (regOrderId && candOrderId && regOrderId === candOrderId) ||
      (candRegId && (candRegId === regDocId || candRegId === regTicketId))
    );
    if (!isNameMatch && !hasExplicitIdLink) {
      return null;
    }
  }

  // Dimension 1: Exact Order ID Match (+40)
  if (regOrderId && candOrderId && regOrderId === candOrderId) {
    score += DIMENSION_WEIGHTS.ORDER_ID;
    matchedDims.push("Order ID");
  }

  // Dimension 2: Exact Registration / Pass ID Match (+35)
  if (candRegId && (candRegId === regDocId || candRegId === regTicketId)) {
    score += DIMENSION_WEIGHTS.PASS_ID;
    matchedDims.push("Pass ID");
  }

  // Dimension 3: Bank UTR Reference Match (+45)
  if (regPaymentId && candUtr) {
    if (regPaymentId === candUtr || (cand.submittedUtr && regPaymentId === cand.submittedUtr)) {
      score += DIMENSION_WEIGHTS.BANK_UTR;
      matchedDims.push("Bank UTR");
    }
  }

  // Dimension 4: Amount / Micro-Paisa Match (+35 for exact micro-paisa, +25 for base offset, +20 for round)
  if (regAmt > 0 && candAmount > 0) {
    const diff = Math.abs(candAmount - regAmt);
    if (diff < 0.005) {
      const hasMicroPaise = Math.round(candAmount * 100) % 100 !== 0;
      if (hasMicroPaise) {
        score += DIMENSION_WEIGHTS.MICRO_PAISA_EXACT;
        matchedDims.push("Micro-Paisa");
      } else {
        score += DIMENSION_WEIGHTS.ROUND_AMOUNT_EXACT;
        matchedDims.push("Exact Amount");
      }
    } else if (diff <= 1.00) {
      score += DIMENSION_WEIGHTS.BASE_FEE_MATCH;
      matchedDims.push("Fee Match (±₹1)");
    }
  }

  // Dimension 5: Temporal Window Correlation (+30 for ≤3m, +20 for ≤15m, +10 for ≤45m)
  let timeDeltaSecs: number | undefined = undefined;
  if (cand.timestamp && regTimeMs > 0) {
    const cTime = new Date(cand.timestamp).getTime();
    if (cTime > 0) {
      timeDeltaSecs = Math.round(Math.abs(cTime - regTimeMs) / 1000);
      if (timeDeltaSecs <= 180) {
        score += DIMENSION_WEIGHTS.TIME_LE_3M;
        matchedDims.push("Time (≤3m)");
      } else if (timeDeltaSecs <= 900) {
        score += DIMENSION_WEIGHTS.TIME_LE_15M;
        matchedDims.push("Time (≤15m)");
      } else if (timeDeltaSecs <= 2700) {
        score += DIMENSION_WEIGHTS.TIME_LE_45M;
        matchedDims.push("Time (≤45m)");
      }
    }
  }

  // Dimension 6: Student Name Token Match (+25)
  const candPayerLower = candPayer.toLowerCase();
  if (candPayerLower && regName) {
    const regTokens = regName.split(/\s+/).filter((t: string) => t.length >= 3);
    const payerTokens = candPayerLower.split(/\s+/).filter((t: string) => t.length >= 3);
    if (regTokens.length > 0 && payerTokens.some((pt: string) => regTokens.some((rt: string) => rt.includes(pt) || pt.includes(rt)))) {
      score += DIMENSION_WEIGHTS.STUDENT_NAME;
      matchedDims.push("Student Name");
    }
  }

  // Dimension 7: Phone Match (+20)
  if (regPhone.length >= 6 && cand.phone && cand.phone.includes(regPhone)) {
    score += DIMENSION_WEIGHTS.PHONE_NUMBER;
    matchedDims.push("Phone");
  }

  const dimsCount = matchedDims.length;
  if (dimsCount === 0 || score < 20) return null;

  const confidence = Math.min(100, Math.round((score / AUTO_APPROVE_CRITERIA.MAX_SCORE_BASELINE) * 100));
  const isEligible = dimsCount >= AUTO_APPROVE_CRITERIA.MIN_DIMENSIONS && score >= AUTO_APPROVE_CRITERIA.MIN_SCORE;

  return {
    utr: candUtr || regPaymentId || "AUTO-APPROVED",
    amount: candAmount || regAmt,
    payerName: cand.payerName,
    source: cand.source,
    score,
    matchedDimensionsCount: dimsCount,
    matchedDimensions: matchedDims,
    confidence,
    isEligibleForAutoApproval: isEligible,
    timeDeltaSeconds: timeDeltaSecs,
  };
}

/**
 * Finds and ranks all candidate signals for a registration, returning the best match
 * that maximizes matched dimensions and total score.
 */
export function findBestMultiDimensionalMatch(
  reg: RegistrationForMatching,
  candidates: PaymentCandidateSignal[]
): MultiDimensionalMatch | null {
  if (!candidates || candidates.length === 0) return null;

  const scored: MultiDimensionalMatch[] = [];
  for (const c of candidates) {
    const match = evaluateCandidateAgainstRegistration(c, reg);
    if (match) {
      scored.push(match);
    }
  }

  if (scored.length === 0) return null;

  // Rank: Maximum matched dimensions FIRST, then highest score, then smallest time delta
  scored.sort((a, b) => {
    if (b.matchedDimensionsCount !== a.matchedDimensionsCount) {
      return b.matchedDimensionsCount - a.matchedDimensionsCount;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return (a.timeDeltaSeconds || 999999) - (b.timeDeltaSeconds || 999999);
  });

  return scored[0];
}
