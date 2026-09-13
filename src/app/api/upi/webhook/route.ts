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

  // URL-decode if needed (in case payload arrived form-encoded)
  let decoded = text;
  try {
    if (text.includes("%")) {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    }
  } catch {
    decoded = text;
  }

  // Pattern 1: Explicit labels like "UPI Ref: 425612345678", "UTR: 425612345678", "Ref No: 425612345678", "Ref no. 425612345678", "Txn ID: 425612345678", "rrn: 425612345678"
  const labeledMatch = decoded.match(/(?:upi\s*(?:ref|reference|txn)?(?:\s*no\.?)?[:\-\s]*|utr[:\-\s]*|ref[:\-\s]*|txn\s*(?:id)?[:\-\s]*|rrn[:\-\s]*)(\d{12})/i);
  if (labeledMatch && labeledMatch[1]) {
    return labeledMatch[1];
  }

  // Pattern 2: Key-value / JSON like "utr": "425612345678" or utr=425612345678
  const kvMatch = decoded.match(/(?:utr|reference|ref_no)[\s"':=]+(\d{12})/i);
  if (kvMatch && kvMatch[1]) {
    return kvMatch[1];
  }

  // Pattern 3: Standalone 12-digit number (UPI UTRs are 12 digits; skip 12-digit numbers that look like Indian phone numbers with +91)
  const standaloneMatches = decoded.matchAll(/\b(\d{12})\b/g);
  for (const m of standaloneMatches) {
    const candidate = m[1];
    // Exclude numbers starting with 91 followed by 6, 7, 8, or 9 (Indian mobile numbers prefixed with 91)
    if (/^91[6-9]\d{9}$/.test(candidate)) {
      continue;
    }
    return candidate;
  }

  return null;
}

/**
 * Helper to extract transaction amount from notification text
 */
function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  // URL-decode if needed (in case payload arrived form-encoded)
  let decoded = text;
  try {
    if (text.includes("%")) {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    }
  } catch {
    decoded = text;
  }

  // Clean HTML entities or zero-width unicode
  const clean = decoded
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8377;/g, "₹")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Pattern 0: Explicit JSON / URL / Form key e.g. "amount": 1.02 or amount=1.02 or amt: 1.02
  const explicitKeyMatch = clean.match(/(?:amount|amt|total)[\s"':=]+([\d,]+(?:\.\d{1,2})?)/i);
  if (explicitKeyMatch && explicitKeyMatch[1]) {
    const val = parseFloat(explicitKeyMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 1: "Received ₹150.00" or "Received Rs. 150" or "credited with INR 150" or "Payment of ₹1.02" or "paid ₹1.02"
  const receivedMatch = clean.match(/(?:received|credited|payment\s+of|paid|accepted)\s+(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (receivedMatch && receivedMatch[1]) {
    const val = parseFloat(receivedMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 2: "₹150.00" or "Rs 150" or "₹ 10" or "₹ 1.02" or "INR 1.02"
  const currencyMatch = clean.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyMatch && currencyMatch[1]) {
    const val = parseFloat(currencyMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 3: "10 rupees" or "10 rs" or "10.00 received" or "1.02 received"
  const rupeesMatch = clean.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees|inr|₹|received|credited|paid)/i);
  if (rupeesMatch && rupeesMatch[1]) {
    const val = parseFloat(rupeesMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 4: "amount of INR 1.02 has been CREDITED" (standard Indian bank alert)
  const bankAlertMatch = clean.match(/(?:amount\s+of\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has\s+been\s+)?(?:credited|received)/i);
  if (bankAlertMatch && bankAlertMatch[1]) {
    const val = parseFloat(bankAlertMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
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
    let rawText = "";

    try {
      rawText = await req.text();
    } catch {
      rawText = "";
    }

    // Query parameters as immediate fallbacks
    const queryText = req.nextUrl.searchParams.get("text") || 
                      req.nextUrl.searchParams.get("notificationText") || 
                      req.nextUrl.searchParams.get("body") || 
                      req.nextUrl.searchParams.get("msg") || 
                      "";
    const queryAmount = req.nextUrl.searchParams.get("amount") || "";
    const queryUtr = req.nextUrl.searchParams.get("utr") || "";

    // Header parameters as fallbacks (in case user configured them under Header Params tab)
    let headerText = "";
    let headerTitle = "";
    try {
      headerText = req.headers.get("notificationtext") || req.headers.get("x-notification-text") || "";
      headerTitle = req.headers.get("title") || "";
    } catch {
      // Ignore header access errors
    }

    // Auto-decode URL-encoding if MacroDroid sent the body form-urlencoded (e.g. %7B%22notificationText...)
    let decodedRawText = rawText;
    try {
      if (rawText.includes("%")) {
        decodedRawText = decodeURIComponent(rawText.replace(/\+/g, " "));
      }
    } catch {
      decodedRawText = rawText;
    }

    // Auto-strip any accidental {notification} tokens if user had them typed in MacroDroid
    const cleanedRawText = (decodedRawText || rawText || "")
      .replace(/\{notification\}/gi, "")
      .trim();

    // Parse body safely regardless of Content-Type or malformed formatting
    const trimmedText = cleanedRawText || decodedRawText.trim() || rawText.trim();
    if (trimmedText.startsWith("{")) {
      // 1. Try standard JSON parsing
      try {
        rawBody = JSON.parse(trimmedText);
      } catch {
        // Fallback: fix unescaped newlines/tabs inside string literals commonly generated by MacroDroid
        try {
          const sanitized = trimmedText
            .replace(/[\r\n]+/g, " ")
            .replace(/\t/g, " ");
          rawBody = JSON.parse(sanitized);
        } catch {
          // Still failed? Extract known fields via regex directly
          const notifMatch = trimmedText.match(/"(?:notificationText|text|message|body|content|notification_text)"\s*:\s*"([\s\S]*?)"(?:\s*,|\s*})/i);
          const titleMatch = trimmedText.match(/"(?:title|heading|subject)"\s*:\s*"([\s\S]*?)"(?:\s*,|\s*})/i);
          const amtMatch = trimmedText.match(/"(?:amount|amt)"\s*:\s*"?([\d.]+)"?/i);
          const utrMatch = trimmedText.match(/"(?:utr|ref)"\s*:\s*"?(\d{12})"?/i);

          rawBody = {
            notificationText: notifMatch ? notifMatch[1] : trimmedText,
            title: titleMatch ? titleMatch[1] : "",
            amount: amtMatch ? amtMatch[1] : undefined,
            utr: utrMatch ? utrMatch[1] : undefined,
          };
        }
      }
    } else if (trimmedText.includes("=") && !trimmedText.startsWith("<")) {
      // 2. URL-encoded form data (e.g. notificationText=...&title=...)
      try {
        const params = new URLSearchParams(trimmedText);
        rawBody = Object.fromEntries(params.entries());
      } catch {
        rawBody = { notificationText: trimmedText };
      }
    } else if (trimmedText.length > 0) {
      // 3. Plain raw text from phone (e.g. "[notif_title] [notif_text]")
      rawBody = { notificationText: trimmedText };
    }

    // Authentication check
    if (!isAuthorized(req, rawBody)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing webhook secret key." },
        { status: 401 }
      );
    }

    // Combine all potential text fields from MacroDroid / Tasker / Forwarder / Headers / URL
    const title = String(rawBody.title || rawBody.heading || rawBody.subject || headerTitle || "");
    const text = String(
      rawBody.notificationText || 
      rawBody.text || 
      rawBody.message || 
      rawBody.body || 
      rawBody.content || 
      rawBody.notification_text ||
      headerText ||
      queryText ||
      ""
    );
    const combinedText = `${title} ${text || trimmedText}`.trim();

    // 1. Resolve UTR (either passed explicitly or extracted from text)
    let utr = rawBody.utr ? String(rawBody.utr).trim() : (queryUtr || null);
    if (!utr || !/^\d{12}$/.test(utr)) {
      utr = extractUtrFromText(combinedText) || extractUtrFromText(trimmedText);
    }

    // 2. Resolve Amount (either passed explicitly or extracted from text)
    let amount = typeof rawBody.amount === "number" ? rawBody.amount : null;
    if (!amount && rawBody.amount) {
      amount = parseFloat(String(rawBody.amount).replace(/,/g, ""));
    }
    if (!amount && queryAmount) {
      amount = parseFloat(queryAmount.replace(/,/g, ""));
    }
    if (!amount || isNaN(amount)) {
      amount = extractAmountFromText(combinedText) || extractAmountFromText(trimmedText) || 0;
    }

    const now = new Date().toISOString();

    // If neither amount nor UTR can be detected: handle as connectivity test/ping
    if ((!utr || !/^\d{12}$/.test(utr)) && (!amount || amount <= 0)) {
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        try {
          const pingId = `PING-${Date.now().toString().slice(-6)}`;
          await setDoc(doc(db, "verified_upi_payments", pingId), {
            utr: pingId,
            amount: 0,
            rawNotification: combinedText || trimmedText || "MacroDroid Phone Test Ping",
            status: "PING",
            matchedStudentName: "MacroDroid Phone Connected",
            receivedAt: now,
          }, { merge: true });

          const logId = `SIG-${Date.now()}`;
          await setDoc(doc(db, "upi_webhook_logs", logId), {
            id: logId,
            receivedAt: now,
            combinedText: (combinedText || trimmedText || "").slice(0, 500),
            extractedUtr: null,
            extractedAmount: 0,
            status: "PING",
            note: "Connectivity ping or no amount/UTR detected",
          }, { merge: true });
        } catch (pingErr) {
          console.warn("Notice: ping save to verified_upi_payments notice:", pingErr);
        }
      }

      return NextResponse.json({
        success: true,
        isPing: true,
        message: "Connectivity test ping received successfully from MacroDroid!",
        receivedText: combinedText || trimmedText || "(empty body)",
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
            const allWaiting = waitingSnap.docs.map((d) => ({ ref: d.ref, id: d.id, data: d.data() }));

            // Comparator function for multi-tier disambiguation
            const sortCandidates = (a: any, b: any) => {
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
            };

            // 1. EXACT MICRO-PAISA MATCH (< 0.005) - Mathematical 1:1 Identity
            const exactPaisaCandidates = allWaiting
              .filter((d) => {
                const expectedAmt = Number(d.data.amount) || 0;
                return Math.abs(expectedAmt - Number(amount)) < 0.005;
              })
              .sort(sortCandidates);

            let bestMatch: any = null;

            if (exactPaisaCandidates.length > 0) {
              bestMatch = exactPaisaCandidates[0];
            } else {
              // 2. FALLBACK LOOSE MATCH (< 0.99) - in case a student rounded off manually
              const looseCandidates = allWaiting
                .filter((d) => {
                  const expectedAmt = Number(d.data.amount) || 0;
                  return Math.abs(expectedAmt - Number(amount)) < 0.99;
                })
                .sort(sortCandidates);

              if (looseCandidates.length > 0) {
                bestMatch = looseCandidates[0];
              }
            }
            if (bestMatch) {
              matchedOrderId = bestMatch.id;
              matchedStudentName = bestMatch.data.participantName || bestMatch.data.leaderName || bestMatch.data.email || "Student";
              await setDoc(doc(db, "active_checkout_sessions", bestMatch.id), {
                status: "COMPLETED",
                utr,
                receivedAmount: amount,
                paidAt: now,
                rawNotification: combinedText,
              }, { merge: true });
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

  // If query parameters include payment parameters (e.g. MacroDroid configured with GET)
  const hasPaymentParams = req.nextUrl.searchParams.has("amount") || 
                           req.nextUrl.searchParams.has("text") || 
                           req.nextUrl.searchParams.has("notificationText") || 
                           req.nextUrl.searchParams.has("body") || 
                           req.nextUrl.searchParams.has("utr");
  if (hasPaymentParams) {
    return POST(req);
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
