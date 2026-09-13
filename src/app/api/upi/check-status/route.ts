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
      const { collection, query, where, getDocs } = await import("firebase/firestore");

      // 1. Check active_checkout_sessions by orderId
      if (orderId) {
        try {
          const sessionRef = doc(db, "active_checkout_sessions", orderId);
          const snap = await getDoc(sessionRef);

          if (snap.exists()) {
            const data = snap.data();
            if (data?.status === "COMPLETED") {
              return NextResponse.json({
                status: "PAID",
                orderId,
                utr: data.utr,
                amount: data.receivedAmount || data.amount,
                paidAt: data.paidAt,
              });
            }
          }
        } catch {}
      }

      // 2. Check verified_upi_payments by UTR
      if (utr && /^\d{12}$/.test(utr)) {
        try {
          const payDocRef = doc(db, "verified_upi_payments", utr);
          const paySnap = await getDoc(payDocRef);
          if (paySnap.exists()) {
            const data = paySnap.data();
            return NextResponse.json({
              status: "PAID",
              orderId: data.matchedOrderId || orderId,
              utr,
              amount: data.amount,
              paidAt: data.receivedAt,
            });
          }
        } catch {}
      }

      // 3. Check registrations collection by regId, orderId, or paymentId (UTR)
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
              });
            }
          }
        }

        if (orderId) {
          const qOrder = query(collection(db, "registrations"), where("orderId", "==", orderId));
          const snapOrder = await getDocs(qOrder);
          if (!snapOrder.empty) {
            const data = snapOrder.docs[0].data();
            if (data?.paymentStatus === "PAID") {
              return NextResponse.json({
                status: "PAID",
                orderId,
                utr: data.paymentId || utr,
                amount: data.amountPaid,
                paidAt: data.paidAt,
              });
            }
          }
        }

        if (utr && /^\d{12}$/.test(utr)) {
          const qUtr = query(collection(db, "registrations"), where("paymentId", "==", utr));
          const snapUtr = await getDocs(qUtr);
          if (!snapUtr.empty) {
            const data = snapUtr.docs[0].data();
            if (data?.paymentStatus === "PAID") {
              return NextResponse.json({
                status: "PAID",
                orderId: data.orderId || orderId,
                utr,
                amount: data.amountPaid,
                paidAt: data.paidAt,
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
