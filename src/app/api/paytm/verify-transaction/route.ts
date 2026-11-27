import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      orderId, 
      txnId, 
      amount, 
      registrationId,
      txnToken,
      paymentMethod = "UPI" 
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { verified: false, error: "Missing Order ID for transaction verification." },
        { status: 400 }
      );
    }

    const mid = process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID || "YICGYk78325672706387";
    const merchantKey = process.env.PAYTM_MERCHANT_KEY || "";

    // 1. If official Paytm credentials are live, query Paytm Order Status API
    if (mid && merchantKey && !mid.includes("placeholder") && !merchantKey.includes("placeholder")) {
      try {
        const host = process.env.PAYTM_ENVIRONMENT === "STAGE" 
          ? "securegw-stage.paytm.in" 
          : "securegw.paytm.in";

        const statusPayload = {
          body: {
            mid: mid,
            orderId: orderId,
          },
        };

        const statusRes = await fetch(
          `https://${host}/v3/order/status`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(statusPayload),
          }
        );

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const resultCode = statusData?.body?.resultInfo?.resultCode;
          const resultStatus = statusData?.body?.resultInfo?.resultStatus;
          const txnAmount = statusData?.body?.txnAmount;

          if (resultStatus === "TXN_SUCCESS" || resultCode === "01") {
            return NextResponse.json({
              verified: true,
              paymentId: statusData?.body?.txnId || txnId || `PTM_${Date.now()}`,
              orderId: orderId,
              amount: Number(txnAmount || amount || 0),
              gateway: "Paytm for Business",
              message: "Payment successfully verified via Paytm gateway.",
            });
          } else {
            return NextResponse.json(
              { 
                verified: false, 
                error: statusData?.body?.resultInfo?.resultMsg || "Payment verification failed with Paytm." 
              },
              { status: 400 }
            );
          }
        }
      } catch (sdkError: any) {
        console.warn("Paytm online status query error:", sdkError?.message || sdkError);
      }
    }

    // 2. Direct UPI UTR Strict Validation & Anti-Fraud Check
    const utr = (txnId || "").trim();

    if (!utr) {
      return NextResponse.json(
        { 
          verified: false, 
          error: "12-Digit UTR is required. Please make the UPI payment and enter the 12-digit Reference / UTR Number from your payment receipt." 
        },
        { status: 400 }
      );
    }

    // Strict 12-digit numeric check for all Indian UPI bank references
    if (!/^\d{12}$/.test(utr)) {
      return NextResponse.json(
        { 
          verified: false, 
          error: `Invalid UTR format (${utr}). All Indian UPI receipts (GPay, PhonePe, Paytm) provide a 12-digit numeric reference (e.g. 425512345678).` 
        },
        { status: 400 }
      );
    }

    // Check for duplicate UTR submissions across paymentId, submittedUtr, and paymentDetails.bankUtr
    // AND resolve authoritative expectedAmount from active_checkout_sessions/{orderId}
    let authoritativeExpectedAmount = Number(amount || 0);
    let resolvedRegId = String(registrationId || "").trim();

    try {
      const { db } = await import("@/lib/firebase/config");
      const { collection, doc, getDoc, query, where, getDocs, limit } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        if (orderId) {
          const sessionSnap = await getDoc(doc(db, "active_checkout_sessions", String(orderId)));
          if (sessionSnap.exists()) {
            const sData = sessionSnap.data();
            const sAmt = Number(sData?.amount || 0);
            if (sAmt > 0) authoritativeExpectedAmount = sAmt;
            if (!resolvedRegId && sData?.registrationId) {
              resolvedRegId = String(sData.registrationId).trim();
            }
          }
        }

        const [qPayId, qSubUtr, qBankUtr] = await Promise.all([
          getDocs(query(collection(db, "registrations"), where("paymentId", "==", utr), limit(3))),
          getDocs(query(collection(db, "registrations"), where("submittedUtr", "==", utr), limit(3))),
          getDocs(query(collection(db, "registrations"), where("paymentDetails.bankUtr", "==", utr), limit(3))),
        ]);

        const conflictingReg = [...qPayId.docs, ...qSubUtr.docs, ...qBankUtr.docs].find(
          (d) => !resolvedRegId || d.id !== resolvedRegId
        );
        if (conflictingReg) {
          return NextResponse.json(
            {
              verified: false,
              error: `Duplicate UTR detected: This 12-digit UTR (${utr}) has already been submitted for another registration. Please provide your unique payment receipt.`,
            },
            { status: 400 }
          );
        }
      }
    } catch (dbErr) {
      console.warn("Notice: could not run server-side duplicate UTR check:", dbErr);
    }

    if (!authoritativeExpectedAmount || authoritativeExpectedAmount <= 0) {
      return NextResponse.json(
        { verified: false, error: "Invalid or missing authoritative checkout fee for verification." },
        { status: 400 }
      );
    }

    // Check if THIS exact 12-digit UTR was already confirmed by our live Bank SMS webhook
    // Lock 1:1 atomically using runTransaction (NEVER blindly steal UNCLAIMED AUTO-PTM- signals!)
    let autoVerifiedViaWebhook = false;
    let verifiedAmount = authoritativeExpectedAmount;
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, runTransaction, setDoc } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const paymentDocRef = doc(db, "verified_upi_payments", utr);
        const sessionRef = orderId ? doc(db, "active_checkout_sessions", String(orderId)) : null;

        // Step A: Lock verified_upi_payments/{utr} atomically FIRST before updating checkout session
        const txResult = await runTransaction(db, async (tx) => {
          const paymentSnap = await tx.get(paymentDocRef);
          if (!paymentSnap.exists()) {
            return { matched: false };
          }
          const paymentData = paymentSnap.data();

          // 1:1 Exclusivity Guard
          if (
            paymentData.claimedByRegistrationId &&
            (!resolvedRegId || paymentData.claimedByRegistrationId !== resolvedRegId)
          ) {
            throw new Error(`CONFLICT:UTR ${utr} is already claimed by another registration.`);
          }
          if (
            paymentData.claimedByOrderId &&
            paymentData.claimedByOrderId !== orderId &&
            (!resolvedRegId || paymentData.claimedByRegistrationId !== resolvedRegId)
          ) {
            throw new Error(`CONFLICT:UTR ${utr} is already locked to another checkout order.`);
          }

          const payAmt = Number(paymentData.amount || 0);
          if (payAmt <= 0) return { matched: false };

          const expHasMicro = Math.round(authoritativeExpectedAmount * 100) % 100 !== 0;
          const payHasMicro = Math.round(payAmt * 100) % 100 !== 0;
          const diff = Math.abs(payAmt - authoritativeExpectedAmount);
          const hasMicroConflict = expHasMicro && payHasMicro && diff >= 0.005;

          const isAmountValid =
            !hasMicroConflict &&
            (diff <= 1.0 || payAmt >= authoritativeExpectedAmount);

          const isEligibleToClaim =
            !paymentData.status ||
            paymentData.status === "UNCLAIMED" ||
            paymentData.matchedOrderId === orderId ||
            paymentData.claimedByRegistrationId === resolvedRegId;

          if (!isEligibleToClaim || !isAmountValid) {
            return { matched: false };
          }

          const nowIso = new Date().toISOString();
          tx.set(
            paymentDocRef,
            {
              status: "MATCHED",
              claimedByOrderId: orderId,
              ...(resolvedRegId ? { claimedByRegistrationId: resolvedRegId, matchedRegistrationId: resolvedRegId } : {}),
              matchedOrderId: orderId,
              matchedAt: paymentData.matchedAt || nowIso,
            },
            { merge: true }
          );

          return { matched: true, payAmt, paidAt: paymentData.receivedAt || nowIso, nowIso };
        });

        // Step B: Complete active_checkout_sessions/{orderId} AFTER ledger lock commits
        if (txResult.matched && sessionRef) {
          await setDoc(
            sessionRef,
            {
              status: "COMPLETED",
              utr,
              submittedUtr: utr,
              receivedAmount: txResult.payAmt,
              paidAt: txResult.paidAt,
              completedAt: txResult.nowIso,
              ...(resolvedRegId ? { registrationId: resolvedRegId } : {}),
            },
            { merge: true }
          ).catch((e) => console.warn("Session completion notice after verify-transaction lock:", e));
        }

        if (txResult.matched) {
          autoVerifiedViaWebhook = true;
          verifiedAmount = txResult.payAmt || authoritativeExpectedAmount;
        }
      }
    } catch (whErr: any) {
      if (String(whErr?.message || "").startsWith("CONFLICT:")) {
        return NextResponse.json(
          { verified: false, error: whErr.message.replace(/^CONFLICT:/, "") },
          { status: 409 }
        );
      }
      console.warn("Notice: could not query verified_upi_payments:", whErr);
    }

    if (autoVerifiedViaWebhook) {
      return NextResponse.json({
        verified: true,
        paymentStatus: "PAID", // Auto-approved on the spot via genuine 12-digit Bank UTR!
        paymentId: utr,
        orderId: orderId,
        amount: verifiedAmount,
        gateway: "Paytm Auto-Gateway",
        message: "Payment confirmed in real-time via Bank UTR webhook! Pass activated.",
      });
    }

    return NextResponse.json({
      verified: true,
      paymentStatus: "PENDING", // PENDING until approved by Treasurer or phone webhook
      paymentId: utr,
      orderId: orderId,
      amount: authoritativeExpectedAmount,
      gateway: "Paytm UPI",
      message: "UTR submitted successfully. Delegate pass created in Pending Verification status.",
    });

  } catch (error: any) {
    console.error("Paytm transaction verification error:", error);
    return NextResponse.json(
      { verified: false, error: error?.message || "Failed to verify transaction." },
      { status: 500 }
    );
  }
}
