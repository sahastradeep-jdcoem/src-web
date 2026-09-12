import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      orderId, 
      txnId, 
      amount, 
      txnToken,
      paymentMethod = "UPI" 
    } = body;

    if (!orderId) {
      return NextResponse.json(
        { verified: false, error: "Missing Order ID for transaction verification." },
        { status: 400 }
      );
    }

    const mid = process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID || "";
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

    // Check for duplicate UTR submissions in Firestore to prevent reusing the same payment receipt
    try {
      const { db } = await import("@/lib/firebase/config");
      const { collection, query, where, getDocs } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const q = query(
          collection(db, "student_registrations"),
          where("paymentId", "==", utr)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          return NextResponse.json(
            { 
              verified: false, 
              error: `Duplicate UTR detected: This 12-digit UTR (${utr}) has already been submitted for another registration. Please provide your unique payment receipt.` 
            },
            { status: 400 }
          );
        }
      }
    } catch (dbErr) {
      console.warn("Notice: could not run server-side duplicate UTR check:", dbErr);
    }

    // Check if the 12-digit UTR was already confirmed via our live mobile webhook
    let autoVerifiedViaWebhook = false;
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const paymentDocRef = doc(db, "verified_upi_payments", utr);
        const paymentSnap = await getDoc(paymentDocRef);
        if (paymentSnap.exists()) {
          const paymentData = paymentSnap.data();
          const expectedAmount = Number(amount || 0);
          // If amount is valid or matches expected fee
          if (!expectedAmount || (paymentData.amount && paymentData.amount >= expectedAmount)) {
            autoVerifiedViaWebhook = true;
            await updateDoc(paymentDocRef, {
              status: "MATCHED",
              matchedOrderId: orderId,
              matchedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (whErr) {
      console.warn("Notice: could not query verified_upi_payments:", whErr);
    }

    if (autoVerifiedViaWebhook) {
      return NextResponse.json({
        verified: true,
        paymentStatus: "PAID", // Auto-approved on the spot!
        paymentId: utr,
        orderId: orderId,
        amount: Number(amount || 0),
        gateway: "Paytm Auto-Gateway",
        message: "Payment confirmed in real-time via Paytm webhook! Pass activated.",
      });
    }

    return NextResponse.json({
      verified: true,
      paymentStatus: "PENDING", // PENDING until approved by Treasurer or phone webhook
      paymentId: utr,
      orderId: orderId,
      amount: Number(amount || 0),
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
