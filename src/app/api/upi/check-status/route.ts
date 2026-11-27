import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * GET /api/upi/check-status?orderId=<orderId>
 * Checks if an active checkout session has been completed by phone webhook
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId") || "";
  const utr = req.nextUrl.searchParams.get("utr") || "";
  const regId = req.nextUrl.searchParams.get("regId") || "";

  if (!orderId && !utr && !regId) {
    return NextResponse.json({ status: "ERROR", error: "Missing orderId, utr, or regId parameter" }, { status: 400 });
  }

  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const { collection, query, where, getDocs, limit } = await import("firebase/firestore");

      // 1. Check active_checkout_sessions by orderId
      if (orderId) {
        try {
          const sessionRef = doc(db, "active_checkout_sessions", orderId);
          const snap = await getDoc(sessionRef);

          if (snap.exists()) {
            const data = snap.data();
            if (data?.status === "COMPLETED") {
              const completedAmount = Number(data.receivedAmount || data.amount || 0);
              const completedUtr = data.utr || data.submittedUtr || "CONFIRMED";
              if (completedAmount > 0 && completedUtr) {
                return NextResponse.json({
                  status: "PAID",
                  orderId,
                  utr: completedUtr,
                  amount: completedAmount,
                  paidAt: data.paidAt || new Date().toISOString(),
                  registrationId: data.registrationId || null,
                });
              }
            }

            if (data?.status === "EXPIRED") {
              // Check if registration was completed or auto-revived by delayed webhook (limit 1)
              try {
                const regCheck = await getDocs(query(collection(db, "registrations"), where("orderId", "==", orderId), limit(1)));
                if (!regCheck.empty && regCheck.docs[0].data().paymentStatus === "PAID") {
                  const r = regCheck.docs[0].data();
                  return NextResponse.json({
                    status: "PAID",
                    orderId,
                    utr: r.paymentId || r.paymentDetails?.utr,
                    amount: r.amountPaid || data.amount,
                    paidAt: r.paidAt || data.paidAt,
                  });
                }
              } catch {}
              return NextResponse.json({ status: "EXPIRED", orderId });
            }

            // Active WAITING session: STRICTLY READ-ONLY (never steal UNCLAIMED payments on GET)
            if (data?.status === "WAITING" && data?.amount) {
              const expiresAtMs = data.expiresAt ? new Date(data.expiresAt).getTime() : 0;
              if (expiresAtMs > 0 && Date.now() > expiresAtMs) {
                return NextResponse.json({ status: "EXPIRED", orderId });
              }

              return NextResponse.json({ status: "WAITING", orderId });
            }
          }
        } catch {}
      }

      // 2. Check verified_upi_payments by UTR ONLY when gated by matching regId or orderId ownership
      if (utr && /^\d{12}$/.test(utr) && (regId || orderId)) {
        try {
          const payDocRef = doc(db, "verified_upi_payments", utr);
          const paySnap = await getDoc(payDocRef);
          if (paySnap.exists()) {
            const data = paySnap.data();
            const isOwned =
              data.status === "MATCHED" &&
              (!regId || data.claimedByRegistrationId === regId || data.matchedRegistrationId === regId) &&
              (!orderId || data.claimedByOrderId === orderId || data.matchedOrderId === orderId);
            if (isOwned) {
              return NextResponse.json({
                status: "PAID",
                orderId: data.matchedOrderId || orderId,
                utr,
                amount: data.amount,
                paidAt: data.receivedAt,
                registrationId: data.claimedByRegistrationId || data.matchedRegistrationId || regId || null,
              });
            }
          }
        } catch {}
      }

      // 3. Check registrations collection by regId or orderId
      try {
        if (regId) {
          const regDoc = await getDoc(doc(db, "registrations", regId));
          if (regDoc.exists()) {
            const data = regDoc.data();
            if (data?.paymentStatus === "PAID") {
              return NextResponse.json({
                status: "PAID",
                orderId: data.orderId || orderId,
                utr: data.paymentId || utr,
                amount: data.amountPaid,
                paidAt: data.paidAt,
                registrationId: regDoc.id,
              });
            }
          }
        }

        if (orderId) {
          const qOrder = query(collection(db, "registrations"), where("orderId", "==", orderId), limit(1));
          const snapOrder = await getDocs(qOrder);
          if (!snapOrder.empty) {
            const regDoc = snapOrder.docs[0];
            const data = regDoc.data();
            if (data?.paymentStatus === "PAID") {
              return NextResponse.json({
                status: "PAID",
                orderId,
                utr: data.paymentId || utr,
                amount: data.amountPaid,
                paidAt: data.paidAt,
                registrationId: regDoc.id,
              });
            }
          }
        }
      } catch {}

      return NextResponse.json({ status: "WAITING", orderId, utr });
    }

    return NextResponse.json({ status: "NOT_FOUND", orderId });
  } catch (error: any) {
    console.warn("Check status error:", error);
    return NextResponse.json({ status: "ERROR", error: error.message }, { status: 500 });
  }
}
