import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc 
} from "firebase/firestore";

const DEFAULT_SECRET = "SRC_UPI_2026_GATEWAY";

/**
 * Helper to extract 12-digit numeric UTR from raw notification text
 */
function extractUtrFromText(text: string): string | null {
  if (!text) return null;

  // Pattern 1: Explicit labels like "UPI Ref: 425612345678", "UTR: 425612345678", "Ref No: 425612345678"
  const labeledMatch = text.match(/(?:upi\s*(?:ref|reference|txn)?(?:\s*no)?[:\-\s]*|utr[:\-\s]*|ref[:\-\s]*)(\d{12})/i);
  if (labeledMatch && labeledMatch[1]) {
    return labeledMatch[1];
  }

  // Pattern 2: Standalone 12-digit number (all Indian UPI transaction IDs are exactly 12 digits)
  const standaloneMatch = text.match(/\b(\d{12})\b/);
  if (standaloneMatch && standaloneMatch[1]) {
    return standaloneMatch[1];
  }

  return null;
}

/**
 * Helper to extract transaction amount from notification text
 */
function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // Pattern 1: "Received ₹150.00" or "Received Rs. 150"
  const receivedMatch = text.match(/(?:received|credited)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (receivedMatch && receivedMatch[1]) {
    return parseFloat(receivedMatch[1].replace(/,/g, ""));
  }

  // Pattern 2: "₹150.00" or "Rs 150"
  const currencyMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyMatch && currencyMatch[1]) {
    return parseFloat(currencyMatch[1].replace(/,/g, ""));
  }

  return null;
}

/**
 * Validate incoming webhook authentication token
 */
function isAuthorized(req: NextRequest, body: any): boolean {
  const configuredSecret = process.env.UPI_WEBHOOK_SECRET || DEFAULT_SECRET;

  // Check 1: Authorization header "Bearer <secret>"
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === configuredSecret) return true;
  }

  // Check 2: Custom header "x-webhook-secret"
  const customHeader = req.headers.get("x-webhook-secret") || "";
  if (customHeader.trim() === configuredSecret) return true;

  // Check 3: Query param "?secret=<secret>"
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  if (querySecret.trim() === configuredSecret) return true;

  // Check 4: Request body secret field
  if (body?.secret && String(body.secret).trim() === configuredSecret) {
    return true;
  }

  return false;
}

/**
 * POST /api/upi/webhook
 * Receives automated notification payloads forwarded from phone
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));

    // Authentication check
    if (!isAuthorized(req, rawBody)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing webhook secret key." },
        { status: 401 }
      );
    }

    // Combine all potential text fields from MacroDroid / Tasker / Forwarder
    const title = String(rawBody.title || rawBody.heading || "");
    const text = String(
      rawBody.notificationText || 
      rawBody.text || 
      rawBody.message || 
      rawBody.body || 
      rawBody.content || 
      ""
    );
    const combinedText = `${title} ${text}`.trim();

    // 1. Resolve UTR (either passed explicitly or extracted from text)
    let utr = rawBody.utr ? String(rawBody.utr).trim() : null;
    if (!utr || !/^\d{12}$/.test(utr)) {
      utr = extractUtrFromText(combinedText);
    }

    // 2. Resolve Amount (either passed explicitly or extracted from text)
    let amount = typeof rawBody.amount === "number" ? rawBody.amount : null;
    if (!amount && rawBody.amount) {
      amount = parseFloat(String(rawBody.amount).replace(/,/g, ""));
    }
    if (!amount || isNaN(amount)) {
      amount = extractAmountFromText(combinedText) || 0;
    }

    if (!utr || !/^\d{12}$/.test(utr)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Could not extract a valid 12-digit UTR from the notification payload.",
          receivedText: combinedText.slice(0, 150)
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 3. Save to verified_upi_payments ledger in Firestore
    let matchedRegistrationId: string | null = null;
    let matchedStudentName: string | null = null;

    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const paymentDocRef = doc(db, "verified_upi_payments", utr);

      // Check if registration with this UTR is already in Firestore
      const regQuery = query(
        collection(db, "student_registrations"),
        where("paymentId", "==", utr)
      );
      const regSnap = await getDocs(regQuery);

      if (!regSnap.empty) {
        // Auto-approve existing registration immediately!
        const matchingDoc = regSnap.docs[0];
        matchedRegistrationId = matchingDoc.id;
        matchedStudentName = matchingDoc.data()?.participantName || matchingDoc.data()?.leaderName || "Student";

        await updateDoc(matchingDoc.ref, {
          paymentStatus: "PAID",
          paidAt: now,
          verifiedBy: "Paytm Auto-Gateway (Webhook)",
          verifiedAt: now,
        });

        // Save ledger entry as MATCHED
        await setDoc(paymentDocRef, {
          utr,
          amount,
          rawNotification: combinedText,
          status: "MATCHED",
          matchedRegistrationId,
          matchedStudentName,
          receivedAt: now,
          matchedAt: now,
        }, { merge: true });
      } else {
        // Registration not submitted yet: store as UNCLAIMED for instant match when student clicks submit
        await setDoc(paymentDocRef, {
          utr,
          amount,
          rawNotification: combinedText,
          status: "UNCLAIMED",
          receivedAt: now,
        }, { merge: true });
      }
    }

    return NextResponse.json({
      success: true,
      utr,
      amount,
      matched: Boolean(matchedRegistrationId),
      matchedRegistrationId,
      matchedStudentName,
      message: matchedRegistrationId
        ? `Payment matched and pass auto-approved for ${matchedStudentName} (${matchedRegistrationId}).`
        : "Payment verified and recorded in ledger. Awaiting student registration submit.",
    });

  } catch (error: any) {
    console.error("UPI Webhook Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal webhook server error." },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upi/webhook
 * Health check & recent transaction inspection for admin setup testing
 */
export async function GET(req: NextRequest) {
  const isAuth = isAuthorized(req, {});
  if (!isAuth) {
    return NextResponse.json({
      status: "ONLINE",
      service: "SRC JDCOEM Automated UPI Webhook Engine",
      note: "Provide valid ?secret= token to view recent verification signals.",
    });
  }

  // If authorized, fetch last 5 received payments
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const snap = await getDocs(collection(db, "verified_upi_payments"));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.receivedAt || "").localeCompare(a.receivedAt || ""))
        .slice(0, 5);

      return NextResponse.json({
        status: "ONLINE",
        totalRecorded: snap.size,
        recentPayments: list,
      });
    }
  } catch (e) {
    // fallback
  }

  return NextResponse.json({ status: "ONLINE", message: "Webhook is live and ready." });
}
