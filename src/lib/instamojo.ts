import { randomBytes, createHmac } from "node:crypto";
import { getSiteContentFromFirestore } from "./firebase/firestore";
import { PAYMENT_CONFIG_DOC_ID, PublicPaymentConfig } from "./paymentConfigStore";
import { getActiveTenure } from "./tenureEngine";

export interface InstamojoCredentials {
  apiKey: string;
  authToken: string;
  salt: string;
  environment: "TEST" | "PROD";
}

export interface CreateInstamojoOrderInput {
  orderId?: string;
  amount: number;
  purpose: string;
  buyerName: string;
  email: string;
  phone: string;
  redirectUrl: string;
  webhookUrl?: string;
  sendEmail?: boolean;
  sendSms?: boolean;
}

export interface InstamojoPaymentRequest {
  id: string;
  phone: string;
  email: string;
  buyer_name: string;
  amount: string;
  purpose: string;
  status: "Pending" | "Completed" | "Failed";
  shorturl: string | null;
  longurl: string;
  redirect_url: string;
  webhook: string | null;
  payments?: Array<{
    payment_id: string;
    status: string;
    currency: string;
    amount: string;
    buyer_name: string;
    buyer_phone: string;
    buyer_email: string;
    created_at: string;
  }>;
}

/**
 * Verified default production keys for SRC JDCOEM (Merchant: SRC JDCOEM Sahastradeep)
 */
const DEFAULT_INSTAMOJO_API_KEY = "23202cf45d3e1a695e8b003c7b4dada3";
const DEFAULT_INSTAMOJO_AUTH_TOKEN = "29fc0a17dad486ae928d63b2245d97fb";
const DEFAULT_INSTAMOJO_SALT = "70488dd63d14427998b1cc7a65f371e0";

/**
 * Resolves Instamojo server credentials with priority:
 * 1. Process environment variables
 * 2. Firestore stored payment_config
 * 3. Verified production merchant credentials
 */
export async function getServerInstamojoCredentials(): Promise<InstamojoCredentials> {
  const envApiKey = process.env.INSTAMOJO_API_KEY?.trim();
  const envAuthToken = process.env.INSTAMOJO_AUTH_TOKEN?.trim();
  const envSalt = process.env.INSTAMOJO_SALT?.trim();
  const envEnvironment = (process.env.INSTAMOJO_ENVIRONMENT?.trim()?.toUpperCase() === "TEST" ? "TEST" : "PROD") as "TEST" | "PROD";

  if (envApiKey && envAuthToken) {
    return {
      apiKey: envApiKey,
      authToken: envAuthToken,
      salt: envSalt || DEFAULT_INSTAMOJO_SALT,
      environment: envEnvironment,
    };
  }

  // Fallback: Check Firestore payment_config
  try {
    const config = await getSiteContentFromFirestore<PublicPaymentConfig>(PAYMENT_CONFIG_DOC_ID);
    if (config?.instamojoApiKey && config?.instamojoAuthToken) {
      return {
        apiKey: config.instamojoApiKey.trim(),
        authToken: config.instamojoAuthToken.trim(),
        salt: config.instamojoSalt?.trim() || DEFAULT_INSTAMOJO_SALT,
        environment: config.instamojoEnvironment === "TEST" ? "TEST" : "PROD",
      };
    }
  } catch (err) {
    console.warn("Notice: could not load Instamojo credentials from Firestore:", err);
  }

  return {
    apiKey: DEFAULT_INSTAMOJO_API_KEY,
    authToken: DEFAULT_INSTAMOJO_AUTH_TOKEN,
    salt: DEFAULT_INSTAMOJO_SALT,
    environment: "PROD",
  };
}

function getBaseUrl(environment: "TEST" | "PROD"): string {
  return environment === "TEST"
    ? "https://test.instamojo.com/api/1.1"
    : "https://www.instamojo.com/api/1.1";
}

/**
 * Creates an Instamojo Payment Request using REST API v1.1
 */
export async function createInstamojoPaymentRequest(
  input: CreateInstamojoOrderInput,
  credentials?: InstamojoCredentials
): Promise<InstamojoPaymentRequest> {
  const creds = credentials || (await getServerInstamojoCredentials());
  const baseUrl = getBaseUrl(creds.environment);

  // Instamojo requires phone in format without +91 or with 10 digits
  const cleanPhone = (input.phone || "9999999999").replace(/\D/g, "").slice(-10);

  // Purpose max length is 30 characters
  const cleanPurpose = (input.purpose || "Event Ticket").slice(0, 30);

  const formParams = new URLSearchParams();
  formParams.append("purpose", cleanPurpose);
  formParams.append("amount", Number(input.amount).toFixed(2));
  formParams.append("buyer_name", input.buyerName || "Student Delegate");
  formParams.append("email", input.email || "student@jdcoem.ac.in");
  formParams.append("phone", cleanPhone);
  formParams.append("redirect_url", input.redirectUrl);
  if (input.webhookUrl) {
    formParams.append("webhook", input.webhookUrl);
  }
  formParams.append("send_email", input.sendEmail ? "True" : "False");
  formParams.append("send_sms", input.sendSms ? "True" : "False");
  formParams.append("allow_repeated_payments", "False");

  const response = await fetch(`${baseUrl}/payment-requests/`, {
    method: "POST",
    headers: {
      "X-Api-Key": creds.apiKey,
      "X-Auth-Token": creds.authToken,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formParams.toString(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success || !data.payment_request) {
    let errorMsg = "Instamojo payment request creation failed.";
    if (typeof data.message === "object" && data.message !== null) {
      const messages = Object.entries(data.message).map(([field, errs]) => {
        const text = Array.isArray(errs) ? errs.join(", ") : String(errs);
        return field === "amount" ? `Amount error: ${text}` : text;
      });
      errorMsg = messages.join(" | ");
    } else if (typeof data.message === "string") {
      errorMsg = data.message;
    } else {
      errorMsg = `Instamojo API Error (HTTP ${response.status})`;
    }
    throw new Error(errorMsg);
  }

  return data.payment_request as InstamojoPaymentRequest;
}

/**
 * Fetches an Instamojo Payment Request by its ID
 */
export async function getInstamojoPaymentRequest(
  requestId: string,
  credentials?: InstamojoCredentials
): Promise<InstamojoPaymentRequest> {
  const creds = credentials || (await getServerInstamojoCredentials());
  const baseUrl = getBaseUrl(creds.environment);

  const response = await fetch(`${baseUrl}/payment-requests/${requestId}/`, {
    method: "GET",
    headers: {
      "X-Api-Key": creds.apiKey,
      "X-Auth-Token": creds.authToken,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.success || !data.payment_request) {
    throw new Error(data.message || `Failed to fetch payment request ${requestId} (HTTP ${response.status})`);
  }

  return data.payment_request as InstamojoPaymentRequest;
}

/**
 * Verifies the MAC signature for Instamojo webhooks
 * Instamojo computes HMAC-SHA1 of sorted POST data (excluding 'mac') keyed by private salt.
 */
export function verifyInstamojoWebhookMac(
  postData: Record<string, any>,
  salt: string
): boolean {
  if (!postData || !postData.mac) return false;

  const providedMac = String(postData.mac).toLowerCase().trim();
  const sortedKeys = Object.keys(postData)
    .filter((k) => k !== "mac")
    .sort((a, b) => a.localeCompare(b));

  const macPayload = sortedKeys.map((k) => `${postData[k]}`).join("|");
  const computedMac = createHmac("sha1", salt).update(macPayload).digest("hex").toLowerCase();

  return computedMac === providedMac;
}

/**
 * Confirms an Instamojo Payment Request and converts the active session into a verified registration.
 * Ensures underpayment protection, event metadata inheritance, and zero double ticketing.
 */
export async function confirmInstamojoOrderRegistration(
  requestId: string,
  customCredentials?: InstamojoCredentials
): Promise<{ success: boolean; registrationId?: string; registration?: any; error?: string }> {
  try {
    const creds = customCredentials || (await getServerInstamojoCredentials());
    const pr = await getInstamojoPaymentRequest(requestId, creds);

    const successfulPayment = pr.payments?.find(
      (p) => p.status === "Credit" || p.status === "Successful" || p.status === "completed"
    );
    const isPaid = pr.status === "Completed" || Boolean(successfulPayment);

    if (!isPaid) {
      return {
        success: false,
        error: `Payment Request ${requestId} has status ${pr.status} and is not paid.`,
      };
    }

    const { db } = await import("@/lib/firebase/config");
    const { doc, getDoc, setDoc, collection, query, where, getDocs } = await import("firebase/firestore");

    if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return { success: false, error: "Database unavailable." };
    }

    const paymentId = successfulPayment?.payment_id || `IM_${requestId}`;
    const amount = Number(successfulPayment?.amount || pr.amount || 0);
    const nowIso = new Date().toISOString();
    const paidAt = successfulPayment?.created_at || nowIso;

    // 1. Fetch active session if available
    let sessionData: any = null;
    try {
      const sessSnap = await getDoc(doc(db, "active_checkout_sessions", requestId));
      if (sessSnap.exists()) {
        sessionData = sessSnap.data();
      }
    } catch (e) {
      console.warn("Notice: could not read checkout session", e);
    }

    // 2. Identify existing registration to prevent duplicate passes
    let existingRegDoc: any = null;
    let targetRegId: string | null = sessionData?.registrationId || null;

    if (targetRegId) {
      try {
        const regSnap = await getDoc(doc(db, "registrations", targetRegId));
        if (regSnap.exists()) {
          existingRegDoc = regSnap.data();
        }
      } catch (e) {}
    }

    if (!existingRegDoc) {
      try {
        const qOrder = query(collection(db, "registrations"), where("orderId", "==", requestId));
        const snapOrder = await getDocs(qOrder);
        if (!snapOrder.empty) {
          existingRegDoc = snapOrder.docs[0].data();
          targetRegId = snapOrder.docs[0].id;
        }
      } catch (e) {}
    }

    if (!existingRegDoc && paymentId) {
      try {
        const qPayment = query(collection(db, "registrations"), where("paymentId", "==", paymentId));
        const snapPayment = await getDocs(qPayment);
        if (!snapPayment.empty) {
          existingRegDoc = snapPayment.docs[0].data();
          targetRegId = snapPayment.docs[0].id;
        }
      } catch (e) {}
    }

    // 3. Record into verified_upi_payments ledger
    try {
      await setDoc(
        doc(db, "verified_upi_payments", paymentId),
        {
          utr: paymentId,
          amount,
          status: "MATCHED",
          matchedRegistrationId: targetRegId || null,
          matchedOrderId: requestId,
          matchedStudentName: pr.buyer_name || sessionData?.participantName || null,
          receivedAt: paidAt,
          matchedAt: nowIso,
          gateway: "instamojo",
        },
        { merge: true }
      );
    } catch (ledgerErr) {
      console.warn("Notice: verified_upi_payments ledger write warning:", ledgerErr);
    }

    // 4. Resolve event metadata
    const draft = sessionData?.registrationData || {};
    const rawEventId = sessionData?.eventId || draft.eventId || "";

    let resolvedEvent: any = null;
    if (rawEventId) {
      try {
        const evSnap = await getDoc(doc(db, "events", rawEventId));
        if (evSnap.exists()) {
          resolvedEvent = { id: evSnap.id, ...evSnap.data() };
        } else {
          const qSlug = query(collection(db, "events"), where("slug", "==", rawEventId));
          const snapSlug = await getDocs(qSlug);
          if (!snapSlug.empty) {
            resolvedEvent = { id: snapSlug.docs[0].id, ...snapSlug.docs[0].data() };
          }
        }
      } catch (evErr) {
        console.warn("Notice: could not dynamically fetch event:", evErr);
      }
    }

    const eventId = resolvedEvent?.id || rawEventId || "event-pass";
    const eventName =
      resolvedEvent?.name ||
      draft.eventName ||
      draft.eventTitle ||
      sessionData?.eventName ||
      pr.purpose ||
      "Event Entry Pass";
    const eventSlug = resolvedEvent?.slug || draft.eventSlug || sessionData?.eventSlug || "event";
    const parentEventId = resolvedEvent?.parentEventId || draft.parentEventId || sessionData?.parentEventId || null;
    const parentEventName = resolvedEvent?.parentEventName || draft.parentEventName || sessionData?.parentEventName || null;
    const subEventBadge = resolvedEvent?.subEventBadge || draft.subEventBadge || sessionData?.subEventBadge || null;
    const tenureId = resolvedEvent?.tenureId || draft.tenureId || sessionData?.tenureId || getActiveTenure().id;

    // Underpayment Shield: Verify paid amount against authoritative fee
    let expectedFee = Number(sessionData?.expectedAmount || sessionData?.authoritativeFee || 0);
    if (!expectedFee && resolvedEvent) {
      const isTeam =
        draft.teamType === "Team" ||
        sessionData?.registrationData?.teamType === "Team" ||
        (Array.isArray(draft.teamMembers) && draft.teamMembers.length > 1);
      if (isTeam) {
        if (resolvedEvent.feePricingModel === "per_team" && resolvedEvent.teamFeeAmount) {
          expectedFee = Number(resolvedEvent.teamFeeAmount);
        } else {
          const members = Array.isArray(draft.teamMembers) ? draft.teamMembers : [];
          const memberCount = Math.max(1, members.length);
          const perMember = typeof resolvedEvent.feeAmount === "number" ? resolvedEvent.feeAmount : 100;
          expectedFee = perMember * memberCount;
        }
      } else {
        expectedFee = typeof resolvedEvent.feeAmount === "number" ? resolvedEvent.feeAmount : 100;
      }
    }

    if (expectedFee > 0 && amount < expectedFee - 0.01) {
      console.error(`Underpayment detected for Instamojo order ${requestId}: expected ₹${expectedFee}, received ₹${amount}`);
      return {
        success: false,
        error: `Payment amount of ₹${amount} does not meet event fee of ₹${expectedFee}. Pass issuance blocked.`,
      };
    }

    const slugPrefix = (eventSlug.slice(0, 3) || "SRC").toUpperCase();
    const entropyHex = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
    const entropyNum = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
    const regId = targetRegId || `SRC-${slugPrefix}-26-${entropyHex}`;
    const tkCode = existingRegDoc?.ticketCode || draft.ticketCode || `${slugPrefix}26-TK-${entropyNum}`;

    let finalRecord: any;

    if (existingRegDoc) {
      finalRecord = {
        ...existingRegDoc,
        id: targetRegId || regId,
        registrationId: targetRegId || regId,
        orderId: requestId,
        paymentStatus: "PAID",
        status: "CONFIRMED",
        paymentId,
        amountPaid: amount,
        paidAt,
        eventId,
        eventName,
        eventTitle: eventName,
        eventSlug,
        parentEventId: parentEventId || existingRegDoc.parentEventId || null,
        parentEventName: parentEventName || existingRegDoc.parentEventName || null,
        subEventBadge: subEventBadge || existingRegDoc.subEventBadge || null,
        tenureId: tenureId || existingRegDoc.tenureId || getActiveTenure().id,
        ticketCode: tkCode,
        verifiedBy: "Instamojo Payment Gateway (Verified)",
        verifiedAt: nowIso,
      };
    } else {
      finalRecord = {
        ...draft,
        id: regId,
        registrationId: regId,
        ticketCode: tkCode,
        participantName: pr.buyer_name || draft.fullName || draft.participantName || "Delegate",
        email: pr.email || draft.email || "student@jdcoem.ac.in",
        phone: pr.phone?.replace("+91", "") || draft.phone || "9999999999",
        orderId: requestId,
        paymentStatus: "PAID",
        status: "CONFIRMED",
        paymentId,
        amountPaid: amount,
        paidAt,
        eventId,
        eventName,
        eventTitle: eventName,
        eventSlug,
        parentEventId,
        parentEventName,
        subEventBadge,
        tenureId,
        verifiedBy: "Instamojo Payment Gateway (Verified)",
        verifiedAt: nowIso,
        registeredAt: nowIso,
        createdAt: nowIso,
      };
    }

    await setDoc(doc(db, "registrations", regId), finalRecord, { merge: true });

    // Mark active checkout session as COMPLETED
    try {
      await setDoc(
        doc(db, "active_checkout_sessions", requestId),
        {
          status: "COMPLETED",
          completedAt: nowIso,
          paymentId,
          registrationId: regId,
        },
        { merge: true }
      );
    } catch (e) {}

    return {
      success: true,
      registrationId: regId,
      registration: finalRecord,
    };
  } catch (error: any) {
    console.error("Instamojo confirmation error:", error);
    return {
      success: false,
      error: error.message || "Failed to confirm Instamojo order.",
    };
  }
}
