import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";

/**
 * POST /api/upi/confirm-pass
 *
 * Server-authoritative pass activation endpoint.
 * Replaces insecure client-side Firestore `paymentStatus: "PAID"` writes.
 *
 * Verifies:
 * 1. An active/completed checkout session (`orderId`) with receivedAmount >= amount
 *    AND/OR a verified ledger proof in `verified_upi_payments/{utr}`.
 * 2. Strict 1:1 ownership lock: `claimedByRegistrationId` & `claimedByOrderId` cannot belong to another student.
 * 3. No conflicting 12-digit manual UTR on the target registration.
 * 4. Locks ledger + session atomically via `runTransaction`, then activates `registrations/{regId}`.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      registrationId: rawRegId,
      orderId: rawOrderId,
      utr: rawUtr,
      registrationData,
    } = body || {};

    if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      return NextResponse.json(
        { confirmed: false, error: "Database configuration unavailable." },
        { status: 500 }
      );
    }
    const firestoreDb = db;

    const orderId = String(rawOrderId || registrationData?.orderId || "").trim();
    const inputUtr = String(rawUtr || "").trim();
    let targetRegId = String(rawRegId || registrationData?.id || "").trim();

    if (!targetRegId && !orderId) {
      return NextResponse.json(
        { confirmed: false, error: "Missing registrationId or orderId." },
        { status: 400 }
      );
    }

    // Resolve existing registration if only orderId was passed
    let existingReg: Record<string, any> | null = null;
    if (targetRegId) {
      const regSnap = await getDoc(doc(db, "registrations", targetRegId));
      if (regSnap.exists()) {
        existingReg = { id: regSnap.id, ...regSnap.data() };
      }
    } else if (orderId) {
      const regByOrderSnap = await getDocs(
        query(
          collection(db, "registrations"),
          where("orderId", "==", orderId),
          limit(1)
        )
      );
      if (!regByOrderSnap.empty) {
        const d = regByOrderSnap.docs[0];
        targetRegId = d.id;
        existingReg = { id: d.id, ...d.data() };
      }
    }

    if (!targetRegId) {
      return NextResponse.json(
        { confirmed: false, error: "Could not resolve target registration record." },
        { status: 404 }
      );
    }

    // Read session state if orderId exists
    const effectiveOrderId = orderId || String(existingReg?.orderId || "").trim();
    const sessionRef = effectiveOrderId
      ? doc(db, "active_checkout_sessions", effectiveOrderId)
      : null;
    const preSessionSnap = sessionRef ? await getDoc(sessionRef) : null;
    const preSession = preSessionSnap?.exists() ? preSessionSnap.data() : null;

    // Candidate UTR from session, input, or existing manual submittedUtr
    const candidateUtr = String(
      preSession?.utr ||
        preSession?.submittedUtr ||
        inputUtr ||
        existingReg?.submittedUtr ||
        ""
    ).trim();

    if (
      preSession?.status !== "COMPLETED" &&
      !candidateUtr
    ) {
      return NextResponse.json(
        {
          confirmed: false,
          error: "Payment session is not completed and no verified UTR is available.",
        },
        { status: 409 }
      );
    }

    // Ensure target 12-digit UTR isn't already PAID on a different registration
    if (candidateUtr && /^\d{12}$/.test(candidateUtr)) {
      const [dupPaySnap, dupBankSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "registrations"),
            where("paymentId", "==", candidateUtr),
            limit(3)
          )
        ),
        getDocs(
          query(
            collection(db, "registrations"),
            where("paymentDetails.bankUtr", "==", candidateUtr),
            limit(3)
          )
        ),
      ]);
      const conflictDoc = [...dupPaySnap.docs, ...dupBankSnap.docs].find(
        (d) => d.id !== targetRegId && d.data()?.paymentStatus === "PAID"
      );
      if (conflictDoc) {
        return NextResponse.json(
          {
            confirmed: false,
            error: `UTR ${candidateUtr} is already assigned to another paid registration.`,
          },
          { status: 409 }
        );
      }
    }

    // Check 12-digit manual UTR mismatch against registration
    const existingManualUtr = String(
      existingReg?.submittedUtr || existingReg?.paymentDetails?.bankUtr || ""
    ).trim();
    if (
      existingManualUtr &&
      /^\d{12}$/.test(existingManualUtr) &&
      candidateUtr &&
      /^\d{12}$/.test(candidateUtr) &&
      existingManualUtr !== candidateUtr
    ) {
      return NextResponse.json(
        {
          confirmed: false,
          error: `Manual UTR (${existingManualUtr}) conflicts with verified Bank UTR (${candidateUtr}).`,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();

    // Transaction 1: Atomically verify & lock ledger proof + checkout session to this exact targetRegId (1:1 invariant)
    const lockResult = await runTransaction(db, async (tx) => {
      const sessionSnap = sessionRef ? await tx.get(sessionRef) : null;
      const sessionData = sessionSnap?.exists() ? sessionSnap.data() : null;

      if (sessionData?.registrationId && sessionData.registrationId !== targetRegId) {
        throw new Error("CONFLICT:SESSION_OWNED_BY_ANOTHER_REGISTRATION");
      }

      const resolvedUtr = String(
        sessionData?.utr || sessionData?.submittedUtr || candidateUtr || ""
      ).trim();

      const ledgerRef = resolvedUtr
        ? doc(firestoreDb, "verified_upi_payments", resolvedUtr)
        : null;
      const ledgerSnap = ledgerRef ? await tx.get(ledgerRef) : null;
      const ledgerData = ledgerSnap?.exists() ? ledgerSnap.data() : null;

      if (
        ledgerData?.claimedByRegistrationId &&
        ledgerData.claimedByRegistrationId !== targetRegId
      ) {
        throw new Error("CONFLICT:UTR_ALREADY_CLAIMED_BY_ANOTHER_STUDENT");
      }

      const hasCompletedSession = Boolean(
        sessionData &&
          sessionData.status === "COMPLETED" &&
          Number(sessionData.amount || 0) > 0 &&
          Number(sessionData.receivedAmount || 0) >= Number(sessionData.amount || 0)
      );

      const expectedFee = Number(
        sessionData?.amount || existingReg?.amountPaid || registrationData?.amountPaid || 0
      );
      const ledgerAmt = Number(ledgerData?.amount || 0);
      const hasValidLedgerProof = Boolean(
        ledgerData &&
          ["MATCHED", "UNCLAIMED"].includes(String(ledgerData.status || "")) &&
          ledgerAmt > 0 &&
          (!expectedFee || Math.abs(ledgerAmt - expectedFee) <= 1.0 || ledgerAmt >= expectedFee)
      );

      // Anti-theft guard: an UNCLAIMED ledger record can ONLY be claimed here if it ALSO matches session/order or 12-digit UTR already on this reg
      const isAuthorizedToClaimLedger =
        ledgerData?.claimedByRegistrationId === targetRegId ||
        (effectiveOrderId && ledgerData?.matchedOrderId === effectiveOrderId) ||
        (effectiveOrderId && ledgerData?.claimedByOrderId === effectiveOrderId) ||
        (existingManualUtr && /^\d{12}$/.test(existingManualUtr) && existingManualUtr === resolvedUtr) ||
        hasCompletedSession;

      if (!hasCompletedSession && !(hasValidLedgerProof && isAuthorizedToClaimLedger)) {
        throw new Error("UNVERIFIED:NO_AUTHORITATIVE_PAYMENT_PROOF");
      }

      const finalAmount = Number(
        sessionData?.receivedAmount ||
          sessionData?.amount ||
          ledgerData?.amount ||
          expectedFee ||
          0
      );

      const finalPaidAt =
        sessionData?.paidAt || ledgerData?.receivedAt || existingReg?.paidAt || nowIso;

      // Preserve genuine 12-digit manual UTR when session was auto-completed by a synthetic Paytm signal
      const finalPaymentId =
        existingManualUtr &&
        /^\d{12}$/.test(existingManualUtr) &&
        (!resolvedUtr || resolvedUtr.startsWith("AUTO-PTM-"))
          ? existingManualUtr
          : resolvedUtr || existingReg?.paymentId || "AUTO-VERIFIED";

      if (ledgerRef && ledgerSnap?.exists()) {
        tx.set(
          ledgerRef,
          {
            status: "MATCHED",
            claimedByRegistrationId: targetRegId,
            claimedByOrderId: effectiveOrderId || ledgerData?.claimedByOrderId || null,
            matchedRegistrationId: targetRegId,
            matchedOrderId: effectiveOrderId || ledgerData?.matchedOrderId || null,
            matchedAt: ledgerData?.matchedAt || nowIso,
          },
          { merge: true }
        );
      }

      return {
        finalPaymentId,
        resolvedUtr,
        finalAmount,
        finalPaidAt,
        shouldUpdateSession: Boolean(sessionRef && sessionSnap?.exists()),
        sessionCompletedAt: sessionData?.completedAt || nowIso,
        sessionExistingUtr: sessionData?.utr || null,
        sourceApp:
          ledgerData?.sourceApp ||
          ledgerData?.packageName ||
          sessionData?.sourceApp ||
          "UPI Auto-Gateway",
        payerName: ledgerData?.payerName || sessionData?.payerName || null,
        hasLedger: Boolean(ledgerSnap?.exists()),
      };
    });

    // Step 1B: Update session AFTER ledgerRef lock commits (satisfies Firestore Rules Transition 2 get())
    if (sessionRef && lockResult.shouldUpdateSession) {
      await setDoc(
        sessionRef,
        {
          status: "COMPLETED",
          registrationId: targetRegId,
          receivedAmount: lockResult.finalAmount,
          utr: lockResult.resolvedUtr || lockResult.sessionExistingUtr || null,
          paidAt: lockResult.finalPaidAt,
          completedAt: lockResult.sessionCompletedAt,
        },
        { merge: true }
      ).catch((e) => console.warn("Session link update notice:", e));
    }

    // Step 2: Update (or create ONLY if registrationData provided AND session was COMPLETED) registrations/{targetRegId}
    const regRef = doc(db, "registrations", targetRegId);
    const updatePayload: Record<string, any> = {
      ...(registrationData && !existingReg ? registrationData : {}),
      id: targetRegId,
      registrationId: existingReg?.registrationId || registrationData?.registrationId || targetRegId,
      orderId: effectiveOrderId || existingReg?.orderId || registrationData?.orderId || null,
      paymentStatus: "PAID",
      status: "CONFIRMED",
      paymentId: lockResult.finalPaymentId,
      amountPaid: lockResult.finalAmount,
      paidAt: lockResult.finalPaidAt,
      isManualUtr: Boolean(existingReg?.isManualUtr || registrationData?.isManualUtr),
      paymentDetails: {
        ...(existingReg?.paymentDetails || registrationData?.paymentDetails || {}),
        utr: lockResult.finalPaymentId,
        ...(lockResult.resolvedUtr && /^\d{12}$/.test(lockResult.resolvedUtr)
          ? { bankUtr: lockResult.resolvedUtr }
          : {}),
        ...(lockResult.resolvedUtr?.startsWith("AUTO-PTM-")
          ? { syntheticRef: lockResult.resolvedUtr }
          : {}),
        sourceApp: lockResult.sourceApp,
        payerName: lockResult.payerName,
        verifiedAt: nowIso,
        verifiedByServerConfirmPass: true,
      },
    };

    await setDoc(regRef, updatePayload, { merge: true });

    // Mirror safely to student_registrations if present or user has student record
    await setDoc(doc(db, "student_registrations", targetRegId), updatePayload, {
      merge: true,
    }).catch(() => {});

    return NextResponse.json({
      confirmed: true,
      registrationId: targetRegId,
      orderId: effectiveOrderId,
      paymentId: lockResult.finalPaymentId,
      amount: lockResult.finalAmount,
      paidAt: lockResult.finalPaidAt,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to confirm pass.";
    const status = msg.startsWith("CONFLICT:")
      ? 409
      : msg.startsWith("UNVERIFIED:")
        ? 403
        : 500;
    return NextResponse.json(
      {
        confirmed: false,
        error: msg.replace(/^(CONFLICT|UNVERIFIED):/, ""),
      },
      { status }
    );
  }
}
