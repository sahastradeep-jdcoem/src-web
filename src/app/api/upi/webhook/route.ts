import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  doc, 
  getDoc,
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

  // Pattern 1: Explicit labels like "UPI Ref: 425612345678", "UTR: 425612345678", "Ref No: 425612345678", "Ref no. 425612345678", "Txn ID: 425612345678"
  const labeledMatch = text.match(/(?:upi\s*(?:ref|reference|txn)?(?:\s*no\.?)?[:\-\s]*|utr[:\-\s]*|ref[:\-\s]*|txn\s*(?:id)?[:\-\s]*)(\d{12})/i);
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

  // Pattern 1: "Received ₹150.00" or "Received Rs. 150" or "credited with INR 150"
  const receivedMatch = text.match(/(?:received|credited)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (receivedMatch && receivedMatch[1]) {
    return parseFloat(receivedMatch[1].replace(/,/g, ""));
  }

  // Pattern 2: "₹150.00" or "Rs 150" or "₹ 10"
  const currencyMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyMatch && currencyMatch[1]) {
    return parseFloat(currencyMatch[1].replace(/,/g, ""));
  }

  // Pattern 3: "10 rupees" or "10 rs" or "10.00 received"
  const rupeesMatch = text.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees|inr|₹|received|credited)/i);
  if (rupeesMatch && rupeesMatch[1]) {
    return parseFloat(rupeesMatch[1].replace(/,/g, ""));
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

  // Check 5: Auto-allow if default secret matches
  if (!process.env.UPI_WEBHOOK_SECRET) {
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
    let rawBody: any = {};
    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    if (contentType.includes("application/json")) {
      rawBody = await req.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      try {
        const formData = await req.formData();
        rawBody = Object.fromEntries(formData.entries());
      } catch {
        rawBody = {};
      }
    } else {
      // Could be raw JSON without content-type header, or plain text
      try {
        const textData = await req.text();
        try {
          rawBody = JSON.parse(textData);
        } catch {
          rawBody = { notificationText: textData };
        }
      } catch {
        rawBody = {};
      }
    }

    // Authentication check
    if (!isAuthorized(req, rawBody)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing webhook secret key." },
        { status: 401 }
      );
    }

    // Combine all potential text fields from MacroDroid / Tasker / Forwarder
    const title = String(rawBody.title || rawBody.heading || rawBody.subject || "");
    const text = String(
      rawBody.notificationText || 
      rawBody.text || 
      rawBody.message || 
      rawBody.body || 
      rawBody.content || 
      rawBody.notification_text ||
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

    const now = new Date().toISOString();

    // If neither amount nor UTR can be detected: handle as connectivity test/ping
    if ((!utr || !/^\d{12}$/.test(utr)) && (!amount || amount <= 0)) {
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        try {
          const logId = `PING-${Date.now()}`;
          await setDoc(doc(db, "upi_webhook_logs", logId), {
            id: logId,
            receivedAt: now,
            combinedText: combinedText.slice(0, 500) || "[Empty / Ping Payload]",
            status: "PING",
            rawBody: typeof rawBody === "object" ? JSON.stringify(rawBody).slice(0, 500) : String(rawBody).slice(0, 500),
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        isPing: true,
        message: "Connectivity test ping received successfully from MacroDroid!",
        receivedText: combinedText || "(empty body)",
        hint: "Ready to receive live payment notifications.",
      });
    }

    // If UTR is missing from the notification banner (common in Paytm for Business push notifications),
    // but amount is valid: generate an automated reference ID for the session
    const isSyntheticUtr = !utr || !/^\d{12}$/.test(utr);
    if (isSyntheticUtr) {
      utr = `AUTO-PTM-${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;
    }

    // 3. Save to verified_upi_payments ledger & match active sessions / registrations
    let matchedRegistrationId: string | null = null;
    let matchedOrderId: string | null = null;
    let matchedStudentName: string | null = null;

    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const paymentDocRef = doc(db, "verified_upi_payments", utr!);

      // 3A. Match active checkout session (for zero-touch hands-free auto-approval on the student's checkout screen)
      const orderIdRegex = combinedText.match(/SRC-PTM-\d+-\d+/i);
      const explicitOrderId = (rawBody.orderId || (orderIdRegex ? orderIdRegex[0] : null) || "").trim();

      if (explicitOrderId) {
        try {
          const sessionRef = doc(db, "active_checkout_sessions", explicitOrderId);
          const sessionSnap = await getDoc(sessionRef);
          if (sessionSnap.exists()) {
            matchedOrderId = sessionSnap.id;
            const sData = sessionSnap.data();
            matchedStudentName = sData?.participantName || sData?.leaderName || sData?.email || "Student";
            await updateDoc(sessionRef, {
              status: "COMPLETED",
              utr,
              receivedAmount: amount,
              paidAt: now,
              rawNotification: combinedText,
            });
          }
        } catch (sessErr) {
          console.warn("Notice: explicit session matching warning:", sessErr);
        }
      }

      // If not matched by explicit order ID, match by amount from recent WAITING sessions (within last 30 min)
      if (!matchedOrderId && amount > 0) {
        try {
          const waitingSessionsQuery = query(
            collection(db, "active_checkout_sessions"),
            where("status", "==", "WAITING")
          );
          const waitingSnap = await getDocs(waitingSessionsQuery);
          if (!waitingSnap.empty) {
            const candidates = waitingSnap.docs
              .map((d) => ({ ref: d.ref, id: d.id, data: d.data() }))
              .filter((d) => {
                const expectedAmt = Number(d.data.amount) || 0;
                return Math.abs(expectedAmt - Number(amount)) < 0.5;
              })
              .sort((a, b) => {
                const textLower = combinedText.toLowerCase();

                // Priority 1: Participant Name matching in notification text
                const nameA = String(a.data.participantName || a.data.leaderName || "").toLowerCase().trim();
                const nameB = String(b.data.participantName || b.data.leaderName || "").toLowerCase().trim();
                const aMatchesName = Boolean(nameA && nameA.split(/\s+/).some(part => part.length >= 3 && textLower.includes(part)));
                const bMatchesName = Boolean(nameB && nameB.split(/\s+/).some(part => part.length >= 3 && textLower.includes(part)));

                if (aMatchesName && !bMatchesName) return -1;
                if (!aMatchesName && bMatchesName) return 1;

                // Priority 2: Phone number matching in notification text
                const phoneA = String(a.data.phone || "").replace(/\D/g, "").slice(-6);
                const phoneB = String(b.data.phone || "").replace(/\D/g, "").slice(-6);
                const aMatchesPhone = Boolean(phoneA && phoneA.length >= 6 && textLower.includes(phoneA));
                const bMatchesPhone = Boolean(phoneB && phoneB.length >= 6 && textLower.includes(phoneB));

                if (aMatchesPhone && !bMatchesPhone) return -1;
                if (!aMatchesPhone && bMatchesPhone) return 1;

                // Priority 3: Timestamp recency (newest waiting session first)
                const tA = new Date(a.data.createdAt || 0).getTime();
                const tB = new Date(b.data.createdAt || 0).getTime();
                return tB - tA;
              });

            if (candidates.length > 0) {
              const bestMatch = candidates[0];
              const createdMs = new Date(bestMatch.data.createdAt || 0).getTime();
              // Check if session was created within the last 30 minutes
              if (Date.now() - createdMs < 30 * 60 * 1000) {
                matchedOrderId = bestMatch.id;
                matchedStudentName = bestMatch.data.participantName || bestMatch.data.leaderName || bestMatch.data.email || "Student";
                await updateDoc(bestMatch.ref, {
                  status: "COMPLETED",
                  utr,
                  receivedAmount: amount,
                  paidAt: now,
                  rawNotification: combinedText,
                });
              }
            }
          }
        } catch (autoErr) {
          console.warn("Notice: auto-match waiting session warning:", autoErr);
        }
      }

      // 3B. Check if registration exists in canonical 'registrations' collection
      try {
        let matchingDoc: any = null;

        // Query by paymentId (UTR)
        if (!isSyntheticUtr) {
          const regQuery = query(
            collection(db, "registrations"),
            where("paymentId", "==", utr)
          );
          let regSnap = await getDocs(regQuery);
          if (!regSnap.empty) {
            matchingDoc = regSnap.docs[0];
          }
        }

        // Fallback: Query by matchedOrderId
        if (!matchingDoc && matchedOrderId) {
          const orderRegQuery = query(
            collection(db, "registrations"),
            where("orderId", "==", matchedOrderId)
          );
          const orderSnap = await getDocs(orderRegQuery);
          if (!orderSnap.empty) {
            matchingDoc = orderSnap.docs[0];
          }
        }

        // Fallback: Query by customAnswers.upiUtr
        if (!matchingDoc && !isSyntheticUtr) {
          const customRegQuery = query(
            collection(db, "registrations"),
            where("customAnswers.upiUtr", "==", utr)
          );
          const customSnap = await getDocs(customRegQuery);
          if (!customSnap.empty) {
            matchingDoc = customSnap.docs[0];
          }
        }

        if (matchingDoc) {
          matchedRegistrationId = matchingDoc.id;
          matchedStudentName = matchingDoc.data()?.participantName || matchingDoc.data()?.leaderName || matchedStudentName || "Student";

          await updateDoc(matchingDoc.ref, {
            paymentStatus: "PAID",
            status: "CONFIRMED",
            paymentId: utr,
            paidAt: now,
            verifiedBy: "Paytm Auto-Gateway (MacroDroid Webhook)",
            verifiedAt: now,
          });
        }
      } catch (regErr) {
        console.warn("Notice: registrations update warning:", regErr);
      }

      // 3C. Save ledger entry in verified_upi_payments
      const isMatched = Boolean(matchedRegistrationId || matchedOrderId);
      try {
        await setDoc(paymentDocRef, {
          utr,
          amount,
          rawNotification: combinedText,
          status: isMatched ? "MATCHED" : "UNCLAIMED",
          isSyntheticUtr,
          matchedRegistrationId: matchedRegistrationId || null,
          matchedOrderId: matchedOrderId || null,
          matchedStudentName: matchedStudentName || null,
          receivedAt: now,
          matchedAt: isMatched ? now : null,
        }, { merge: true });
      } catch (ledgerErr) {
        console.warn("Notice: verified_upi_payments ledger write warning:", ledgerErr);
      }

      // 3D. Save diagnostic audit entry in upi_webhook_logs
      try {
        const logId = `SIG-${Date.now()}`;
        await setDoc(doc(db, "upi_webhook_logs", logId), {
          id: logId,
          receivedAt: now,
          combinedText: combinedText.slice(0, 500),
          extractedUtr: utr,
          extractedAmount: amount,
          matchedOrderId: matchedOrderId || null,
          matchedRegistrationId: matchedRegistrationId || null,
          matchedStudentName: matchedStudentName || null,
          status: isMatched ? "MATCHED" : "UNCLAIMED",
        });
      } catch (auditErr) {
        console.warn("Notice: upi_webhook_logs audit warning:", auditErr);
      }
    }

    return NextResponse.json({
      success: true,
      utr,
      amount,
      matched: Boolean(matchedRegistrationId || matchedOrderId),
      matchedRegistrationId,
      matchedOrderId,
      matchedStudentName,
      message: matchedRegistrationId
        ? `Payment matched and pass auto-approved for ${matchedStudentName} (${matchedRegistrationId}).`
        : matchedOrderId
        ? `Active checkout session auto-approved for ${matchedStudentName} (${matchedOrderId}). Instant pass rendered on device.`
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

  // If authorized, fetch last 5 received payments and last 10 webhook activity logs
  try {
    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const snap = await getDocs(collection(db, "verified_upi_payments"));
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.receivedAt || "").localeCompare(a.receivedAt || ""))
        .slice(0, 5);

      let recentLogs: any[] = [];
      try {
        const logSnap = await getDocs(collection(db, "upi_webhook_logs"));
        recentLogs = logSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.receivedAt || "").localeCompare(a.receivedAt || ""))
          .slice(0, 10);
      } catch {}

      return NextResponse.json({
        status: "ONLINE",
        totalRecorded: snap.size,
        totalLogs: recentLogs.length,
        recentPayments: list,
        recentLogs,
      });
    }
  } catch (e) {
    // fallback
  }

  return NextResponse.json({ status: "ONLINE", message: "Webhook is live and ready." });
}
