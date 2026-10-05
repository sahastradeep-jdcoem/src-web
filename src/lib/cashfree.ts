/**
 * Cashfree Payment Gateway Engine (v2023-08-01 API)
 * Official integration for SRC JDCOEM — Sahastradeep
 */

import { randomBytes } from "node:crypto";

export interface CashfreeCredentials {
  appId: string;
  secretKey: string;
  environment: "TEST" | "PROD";
}

export interface CreateCashfreeOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerDetails: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
  orderMeta?: {
    returnUrl?: string;
    notifyUrl?: string;
    paymentMethods?: string;
  };
  orderNote?: string;
  orderTags?: Record<string, string>;
}

export interface CashfreeOrderResponse {
  cf_order_id: string | number;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";
  payment_session_id: string;
  order_expiry_time?: string;
  created_at?: string;
  customer_details?: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    payment_methods?: string;
  };
  order_tags?: Record<string, string>;
  order_note?: string;
}

export interface CashfreePaymentItem {
  cf_payment_id: string | number;
  order_id: string;
  entity: string;
  payment_currency: string;
  payment_amount: number;
  payment_time: string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED";
  payment_message?: string;
  bank_reference?: string; // UTR or Bank RRN
  auth_id?: string;
  payment_method?: {
    upi?: {
      channel?: string;
      upi_id?: string;
    };
    card?: {
      channel?: string;
      card_number?: string;
      card_network?: string;
      card_type?: string;
    };
    netbanking?: {
      channel?: string;
      netbanking_bank_name?: string;
    };
    app?: {
      channel?: string;
      provider?: string;
    };
  };
  payment_group?: string;
}

export interface CashfreeRefundResponse {
  cf_refund_id: string | number;
  refund_id: string;
  order_id: string;
  entity: string;
  refund_amount: number;
  refund_currency: string;
  refund_status: "SUCCESS" | "PENDING" | "CANCELLED" | "FAILED";
  refund_mode?: string;
  refund_type?: string;
  refund_arn?: string;
  created_at?: string;
  processed_at?: string;
}

/**
 * Resolve server credentials from server environment only.
 * Never read payment credentials from client state or Firestore.
 */
export async function getServerCashfreeCredentials(): Promise<CashfreeCredentials> {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";

  const environment =
    (process.env.CASHFREE_ENVIRONMENT as "TEST" | "PROD") || "TEST";

  return { appId: appId.trim(), secretKey: secretKey.trim(), environment };
}

/**
 * Returns Cashfree API base endpoint
 */
export function getCashfreeBaseUrl(environment: "TEST" | "PROD"): string {
  return environment === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

/**
 * Standard Cashfree API Request Headers
 */
export function getCashfreeHeaders(credentials: CashfreeCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-version": "2023-08-01",
    "x-client-id": credentials.appId,
    "x-client-secret": credentials.secretKey,
  };
}

/**
 * Create an Order on Cashfree and receive payment_session_id
 */
export async function createCashfreeOrder(
  params: CreateCashfreeOrderParams,
  customCredentials?: CashfreeCredentials
): Promise<CashfreeOrderResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error(
      "Cashfree credentials not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Vercel settings or in Admin Console > Registrations > Payment Settings."
    );
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  // Normalize phone number (must be 10 digits for Indian standard)
  let cleanPhone = (params.customerDetails.customerPhone || "").replace(/\D/g, "");
  if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
  if (cleanPhone.length < 10) cleanPhone = "9999999999";

  const payload = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: params.orderCurrency || "INR",
    customer_details: {
      customer_id: params.customerDetails.customerId || `cust_${Date.now()}`,
      customer_name: params.customerDetails.customerName || "Student Delegate",
      customer_email: params.customerDetails.customerEmail || "student@jdcoem.ac.in",
      customer_phone: cleanPhone,
    },
    order_meta: {
      return_url: params.orderMeta?.returnUrl || null,
      notify_url: params.orderMeta?.notifyUrl || null,
      payment_methods: params.orderMeta?.paymentMethods || null,
    },
    order_note: params.orderNote || "SRC JDCOEM Event Registration",
    order_tags: params.orderTags || null,
  };

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: getCashfreeHeaders(creds),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Order Creation Failed (${response.status}): ${errorMsg}`);
  }

  return data as CashfreeOrderResponse;
}

/**
 * Fetch Order details from Cashfree
 */
export async function getCashfreeOrder(
  orderId: string,
  customCredentials?: CashfreeCredentials
): Promise<CashfreeOrderResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const response = await fetch(`${baseUrl}/orders/${orderId}`, {
    method: "GET",
    headers: getCashfreeHeaders(creds),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Order Fetch Failed (${response.status}): ${errorMsg}`);
  }

  return data as CashfreeOrderResponse;
}

/**
 * Fetch all payment attempts/transactions for an order from Cashfree
 */
export async function getCashfreeOrderPayments(
  orderId: string,
  customCredentials?: CashfreeCredentials
): Promise<CashfreePaymentItem[]> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const response = await fetch(`${baseUrl}/orders/${orderId}/payments`, {
    method: "GET",
    headers: getCashfreeHeaders(creds),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Payments Fetch Failed (${response.status}): ${errorMsg}`);
  }

  return (Array.isArray(data) ? data : []) as CashfreePaymentItem[];
}

/**
 * Initiate an automated instant refund for an order via Cashfree
 */
export async function createCashfreeRefund(
  orderId: string,
  refundAmount: number,
  refundId: string,
  refundNote: string = "Refund by SRC JDCOEM Secretariat",
  customCredentials?: CashfreeCredentials
): Promise<CashfreeRefundResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const payload = {
    refund_id: refundId,
    refund_amount: Number(refundAmount.toFixed(2)),
    refund_note: refundNote,
    refund_speed: "STANDARD",
  };

  const response = await fetch(`${baseUrl}/orders/${orderId}/refunds`, {
    method: "POST",
    headers: getCashfreeHeaders(creds),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  return data as CashfreeRefundResponse;
}

/**
 * Confirm and persist a paid Cashfree order to Firestore.
 * Self-heals if the client-side browser dropped out, closed, or redirected.
 */
export async function confirmCashfreeOrderRegistration(
  orderId: string,
  customCredentials?: CashfreeCredentials
): Promise<{ success: boolean; registrationId?: string; registration?: any; error?: string }> {
  try {
    const creds = customCredentials || (await getServerCashfreeCredentials());
    const order = await getCashfreeOrder(orderId, creds);

    let isPaid = order.order_status === "PAID";
    let paymentDetails: any = null;

    try {
      const payments = await getCashfreeOrderPayments(orderId, creds);
      const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS");
      if (successfulPayment) {
        isPaid = true;
        paymentDetails = {
          cfPaymentId: String(successfulPayment.cf_payment_id),
          utr: successfulPayment.bank_reference || `CF_${successfulPayment.cf_payment_id}`,
          amount: successfulPayment.payment_amount,
          paymentStatus: successfulPayment.payment_status,
          paymentTime: successfulPayment.payment_time,
          paymentMethod: successfulPayment.payment_group || "ONLINE",
        };
      }
    } catch (paymentErr) {
      console.warn("Could not fetch payments for Cashfree order:", orderId, paymentErr);
    }

    if (!isPaid) {
      return { success: false, error: `Order ${orderId} has status ${order.order_status} and is not paid.` };
    }

    const { db } = await import("@/lib/firebase/config");
    const { doc, getDoc, setDoc, collection, query, where, getDocs } = await import("firebase/firestore");

    if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return { success: false, error: "Database unavailable." };
    }

    const utr = paymentDetails?.utr || `CF_${order.cf_order_id}`;
    const amount = Number(paymentDetails?.amount || order.order_amount || 0);
    const nowIso = new Date().toISOString();
    const paidAt = paymentDetails?.paymentTime || nowIso;

    // 1. Fetch active session if available
    let sessionData: any = null;
    try {
      const sessSnap = await getDoc(doc(db, "active_checkout_sessions", orderId));
      if (sessSnap.exists()) {
        sessionData = sessSnap.data();
      }
    } catch (e) {
      console.warn("Notice: could not read checkout session", e);
    }

    // 2. Identify registration document and prevent duplicate pass creation
    let existingRegDoc: any = null;
    let targetRegId: string | null = order.order_tags?.registrationId || sessionData?.registrationId || null;

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
        const qOrder = query(collection(db, "registrations"), where("orderId", "==", orderId));
        const snapOrder = await getDocs(qOrder);
        if (!snapOrder.empty) {
          existingRegDoc = snapOrder.docs[0].data();
          targetRegId = snapOrder.docs[0].id;
        }
      } catch (e) {}
    }

    if (!existingRegDoc && utr) {
      try {
        const qUtr = query(collection(db, "registrations"), where("paymentId", "==", utr));
        const snapUtr = await getDocs(qUtr);
        if (!snapUtr.empty) {
          existingRegDoc = snapUtr.docs[0].data();
          targetRegId = snapUtr.docs[0].id;
        }
      } catch (e) {}
    }

    // 3. First, record into verified_upi_payments (satisfies Firestore security rule for paid registration write)
    try {
      await setDoc(
        doc(db, "verified_upi_payments", utr),
        {
          utr,
          amount,
          status: "MATCHED",
          matchedRegistrationId: targetRegId || null,
          matchedOrderId: orderId,
          matchedStudentName: order.customer_details?.customer_name || sessionData?.participantName || null,
          receivedAt: paidAt,
          matchedAt: nowIso,
          gateway: "cashfree",
        },
        { merge: true }
      );
    } catch (ledgerErr) {
      console.warn("Notice: verified_upi_payments ledger write warning:", ledgerErr);
    }

    // 4. Resolve event metadata dynamically from Firestore to guarantee umbrella & sub-competition linkage (Rule 8)
    const cust = order.customer_details;
    const tags = order.order_tags;
    const draft = sessionData?.registrationData || {};
    const rawEventId = tags?.eventId || sessionData?.eventId || draft.eventId || "";

    let resolvedEvent: any = null;
    if (rawEventId) {
      try {
        const evSnap = await getDoc(doc(db, "events", rawEventId));
        if (evSnap.exists()) {
          resolvedEvent = { id: evSnap.id, ...evSnap.data() };
        } else {
          // Fallback search by slug or name if ID differs
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
    const eventName = resolvedEvent?.name || draft.eventName || draft.eventTitle || sessionData?.eventName || order.order_note?.replace("SRC JDCOEM:", "").trim() || "Event Entry Pass";
    const eventSlug = resolvedEvent?.slug || draft.eventSlug || sessionData?.eventSlug || (rawEventId.includes("-") ? rawEventId : "event");
    const parentEventId = resolvedEvent?.parentEventId || draft.parentEventId || sessionData?.parentEventId || null;
    const parentEventName = resolvedEvent?.parentEventName || draft.parentEventName || sessionData?.parentEventName || null;
    const subEventBadge = resolvedEvent?.subEventBadge || draft.subEventBadge || sessionData?.subEventBadge || null;
    const tenureId = resolvedEvent?.tenureId || draft.tenureId || sessionData?.tenureId || "tenure-2026-27";

    // 4.5. Underpayment Shield: Verify paid amount against authoritative fee
    let expectedFee = Number(sessionData?.expectedAmount || sessionData?.authoritativeFee || 0);
    if (!expectedFee && resolvedEvent) {
      const isTeam = (draft.teamType === "Team") || (sessionData?.registrationData?.teamType === "Team") || (Array.isArray(draft.teamMembers) && draft.teamMembers.length > 1);
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

    if (expectedFee > 0 && amount < (expectedFee - 0.01)) {
      console.error(`Underpayment detected for order ${orderId}: expected ₹${expectedFee}, received ₹${amount}`);
      return {
        success: false,
        error: `Payment amount of ₹${amount} does not meet the authoritative event fee of ₹${expectedFee}. Pass issuance blocked.`,
      };
    }

    const custBtId = cust?.customer_id && cust.customer_id !== "student" && !cust.customer_id.startsWith("cust_")
      ? cust.customer_id.trim().toUpperCase()
      : undefined;

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
        orderId,
        paymentStatus: "PAID",
        status: "CONFIRMED",
        paymentId: utr,
        amountPaid: amount,
        paidAt,
        eventId,
        eventName,
        eventTitle: eventName,
        eventSlug,
        parentEventId: parentEventId || existingRegDoc.parentEventId || null,
        parentEventName: parentEventName || existingRegDoc.parentEventName || null,
        subEventBadge: subEventBadge || existingRegDoc.subEventBadge || null,
        tenureId: tenureId || existingRegDoc.tenureId || "tenure-2026-27",
        ticketCode: tkCode,
        verifiedBy: "Cashfree Payment Gateway (Verified)",
        verifiedAt: nowIso,
      };
    } else {
      finalRecord = {
        ...draft,
        id: regId,
        registrationId: regId,
        eventId,
        eventTitle: eventName,
        eventName,
        eventSlug,
        parentEventId,
        parentEventName,
        subEventBadge,
        tenureId,
        participantName: draft.participantName || draft.leaderName || sessionData?.participantName || cust?.customer_name || "Delegate",
        leaderName: draft.leaderName || draft.participantName || sessionData?.participantName || cust?.customer_name || "Delegate",
        email: draft.email || sessionData?.email || cust?.customer_email || "",
        phone: draft.phone || sessionData?.phone || cust?.customer_phone || "",
        btId: draft.btId || sessionData?.btId || custBtId,
        department: draft.department || "Student",
        year: draft.year || "Student",
        teamType: draft.teamType || "Individual",
        teamSize: draft.teamSize || 1,
        registeredAt: draft.registeredAt || order.created_at || nowIso,
        createdAt: draft.createdAt || nowIso,
        paidAt,
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentId: utr,
        orderId,
        amountPaid: amount,
        ticketCode: tkCode,
        qrPayload: draft.qrPayload || `SRC:JDCOEM:${regId}:${tkCode}:${eventId}:${custBtId || "PASS"}`,
        verifiedBy: "Cashfree Payment Gateway (Self-Healed)",
        verifiedAt: nowIso,
      };
    }

    await setDoc(doc(db, "registrations", finalRecord.id), finalRecord, { merge: true });

    // 5. Update active checkout session
    try {
      await setDoc(
        doc(db, "active_checkout_sessions", orderId),
        {
          orderId,
          status: "COMPLETED",
          paymentStatus: "PAID",
          amount,
          receivedAmount: amount,
          utr,
          completedAt: nowIso,
          registrationId: finalRecord.id,
        },
        { merge: true }
      );
    } catch (sessErr) {
      console.warn("Notice: checkout session update warning:", sessErr);
    }

    return {
      success: true,
      registrationId: finalRecord.id,
      registration: finalRecord,
    };
  } catch (error: any) {
    console.error(`Failed to confirm Cashfree order registration for ${orderId}:`, error);
    return { success: false, error: error.message || "Failed to confirm registration" };
  }
}
