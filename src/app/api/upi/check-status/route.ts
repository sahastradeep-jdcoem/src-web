import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

/**
 * GET /api/upi/check-status?orderId=<orderId>
 * Checks if an active checkout session has been completed by phone webhook
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ status: "ERROR", error: "Missing orderId parameter" }, { status: 400 });
  }

  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
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
        return NextResponse.json({ status: "WAITING", orderId });
      }
    }

    return NextResponse.json({ status: "NOT_FOUND", orderId });
  } catch (error: any) {
    console.warn("Check status error:", error);
    return NextResponse.json({ status: "ERROR", error: error.message }, { status: 500 });
  }
}
