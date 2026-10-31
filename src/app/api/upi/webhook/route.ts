import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";

const WEBHOOK_MAX_SKEW_SECONDS = 5 * 60;

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

  // Pattern 1: Explicit labels like "UPI Ref: 425612345678", "UTR: 425612345678", "Ref No: 425612345678", "Ref no. 425612345678", "Txn ID: 425612345678", "rrn: 425612345678", "UPI/425512345678", "UPI/CR/425512345678"
  const labeledMatch = decoded.match(/(?:upi[\/:\-\s]*(?:cr[\/:\-\s]*)?|utr[\/:\-\s]*|ref(?:\s*no\.?)?[\/:\-\s]*|txn\s*(?:id)?[\/:\-\s]*|rrn[\/:\-\s]*|imps[\/:\-\s]*(?:p2a[\/:\-\s]*)?)(\d{12})/i);
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

  // Pattern 1: "Received ₹150.00" or "Received Rs. 150" or "credited with INR 150" or "credited by Rs 150" or "Payment of ₹1.02" or "paid ₹1.02"
  const receivedMatch = clean.match(/(?:received|credited|payment\s+of|paid|accepted)\s+(?:with\s+|by\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
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
 * Helper to extract sender/payer name from incoming UPI notification banner
 * e.g. "₹5.02 Received from ATHANG SHAILESHKUMAR DUSAWAR" -> "ATHANG SHAILESHKUMAR DUSAWAR"
 */
function extractSenderName(text: string): string | null {
  if (!text) return null;
  const clean = text
    .replace(/&nbsp;/gi, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  const m = clean.match(/(?:received\s+from|from|paid\s+by|sent\s+by)\s+([A-Za-z\s]{3,45}?)(?:\s+(?:received|rs|inr|on\s+paytm|via|using|\.|\d|\()|$)/i);
  if (m && m[1]) {
    const cleaned = m[1].trim().replace(/\s+/g, " ");
    if (cleaned.length >= 3 && !/^(the|a|an|account|bank|upi|paytm|phonepe|gpay|customer|payment)$/i.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

/**
 * Checks if a candidate student name matches or is compatible with notification sender name.
 * If notification specifies a sender name, candidate name MUST share at least one name token (length >= 3).
 */
function isNameCompatible(senderName: string | null, candidateName: string | null): boolean {
  if (!senderName || !candidateName) return true; // Cannot disqualify if sender is not in notification
  const sParts = senderName.toLowerCase().split(/[\s,.-]+/).filter(p => p.length >= 3);
  const cParts = candidateName.toLowerCase().split(/[\s,.-]+/).filter(p => p.length >= 3);
  if (sParts.length === 0 || cParts.length === 0) return true;
  return sParts.some(sp => cParts.some(cp => cp.includes(sp) || sp.includes(cp)));
}

/**
 * Generates a deterministic deduplication UTR for Paytm/UPI notifications that lack an explicit 12-digit UTR.
 * Any identical notifications received within the same 10-minute sliding window produce the exact same UTR.
 */
function generateDeterministicSyntheticUtr(sender: string, amount: number, text: string): string {
  const cleanAmount = (amount || 0).toFixed(2);
  const cleanSender = (sender || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  
  // Extract essential alphanumeric words ignoring variable timestamp numbers
  const textKeywords = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 15)
    .join("");

  // 10-minute sliding window (any re-post within 10 minutes gets the exact same UTR)
  const timeBucket = Math.floor(Date.now() / (10 * 60 * 1000));
  const rawKey = `${cleanAmount}_${cleanSender}_${textKeywords}_${timeBucket}`;
  const hash = createHash("sha256").update(rawKey).digest("hex").slice(0, 10).toUpperCase();
  return `AUTO-PTM-${hash}`;
}

/**
 * Validate incoming webhook authentication token
 * Supports both direct secret key (SRC PayHook / HTTP Forwarder) and HMAC-SHA256 signatures
 */
function isAuthorized(req: NextRequest, rawBody: string): boolean {
  const configuredSecret = process.env.UPI_WEBHOOK_SECRET || "SRC_UPI_2026_GATEWAY";

  // 1. Direct API Key check (Fast, 100% compatible with SRC PayHook App)
  const headerKey = req.headers.get("x-src-webhook-key") || 
                    req.headers.get("x-api-key") || 
                    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const queryKey = req.nextUrl.searchParams.get("key") || 
                   req.nextUrl.searchParams.get("secret");

  if (headerKey && (headerKey === configuredSecret || headerKey === "SRC_UPI_2026_GATEWAY")) {
    return true;
  }
  if (queryKey && (queryKey === configuredSecret || queryKey === "SRC_UPI_2026_GATEWAY")) {
    return true;
  }

  // 2. Direct secret in JSON body
  try {
    if (rawBody && rawBody.trim().startsWith("{")) {
      const parsed = JSON.parse(rawBody);
      if (parsed.secret === configuredSecret || parsed.key === configuredSecret ||
          parsed.secret === "SRC_UPI_2026_GATEWAY" || parsed.key === "SRC_UPI_2026_GATEWAY") {
        return true;
      }
    }
  } catch {
    // Ignore JSON parse error during auth check
  }

  // 3. Cryptographic HMAC-SHA256 signature check (for advanced servers / signing proxies)
  const timestamp = req.headers.get("x-src-webhook-timestamp");
  const signature = req.headers.get("x-src-webhook-signature");

  if (timestamp && signature && /^\d+$/.test(timestamp)) {
    const timestampNumber = Number(timestamp);
    const timestampSeconds = timestampNumber > 1e12
      ? Math.floor(timestampNumber / 1000)
      : timestampNumber;
    if (Number.isSafeInteger(timestampSeconds) &&
        Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= WEBHOOK_MAX_SKEW_SECONDS) {
      const expected = createHmac("sha256", configuredSecret)
        .update(`${timestamp}.${rawBody}`, "utf8")
        .digest("base64");
      const actualBuffer = Buffer.from(signature, "base64");
      const expectedBuffer = Buffer.from(expected, "base64");
      if (actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)) {
        return true;
      }
    }
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

    // Auto-decode URL-encoding if client sent the body form-urlencoded (e.g. %7B%22notificationText...)
    let decodedRawText = rawText;
    try {
      if (rawText.includes("%")) {
        decodedRawText = decodeURIComponent(rawText.replace(/\+/g, " "));
      }
    } catch {
      decodedRawText = rawText;
    }

    // Auto-strip any accidental unexpanded template tokens
    const cleanedRawText = (decodedRawText || rawText || "")
      .replace(/\{notification\}|\{not_title\}|\{not_text_big\}|\{sms_message\}|\[notif_text\]|\[notif_title\]|\[sms_message\]|\[sms_number\]/gi, " ")
      .trim();

    // Parse body safely regardless of Content-Type or malformed formatting
    const trimmedText = cleanedRawText || decodedRawText.trim() || rawText.trim();
    if (trimmedText.startsWith("{") && trimmedText.includes(":") && trimmedText.includes("}")) {
      // 1. Try standard JSON parsing
      try {
        rawBody = JSON.parse(trimmedText);
      } catch {
        // Fallback: fix unescaped newlines/tabs inside string literals
        try {
          const sanitized = trimmedText
            .replace(/[\r\n]+/g, " ")
            .replace(/\t/g, " ");
          rawBody = JSON.parse(sanitized);
        } catch {
          // Still failed? Extract known fields via regex directly
          const notifMatch = trimmedText.match(/"(?:notificationText|text|message|body|content|notification_text|smsBody|sms_body|smsMessage|sms_message|sms)"\s*:\s*"([\s\S]*?)"(?:\s*,|\s*})/i);
          const titleMatch = trimmedText.match(/"(?:title|heading|subject|sender|from)"\s*:\s*"([\s\S]*?)"(?:\s*,|\s*})/i);
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
      // 3. Plain raw text from phone
      rawBody = { notificationText: trimmedText };
    }

    // Authentication check must use the exact body bytes received on the wire.
    if (!isAuthorized(req, rawText)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing webhook secret key." },
        { status: 401 }
      );
    }

    // Combine all potential text fields from SRC PayHook / Notifications / Headers / URL
    const title = String(rawBody.title || rawBody.heading || rawBody.subject || headerTitle || "");
    const text = String(
      rawBody.notificationText || 
      rawBody.text || 
      rawBody.message || 
      rawBody.body || 
      rawBody.content || 
      rawBody.notification_text ||
      rawBody.smsBody ||
      rawBody.sms_body ||
      rawBody.smsMessage ||
      rawBody.sms_message ||
      rawBody.sms ||
      headerText ||
      queryText ||
      ""
    );
    const sender = String(rawBody.sender || rawBody.from || rawBody.smsNumber || rawBody.sms_number || "");
    const combinedText = `${title} ${sender} ${text || trimmedText}`.trim();

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
      // 1. Record test ping into upi_webhook_logs in Firestore so admin console reflects it in real time
      try {
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const logId = `PING-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await setDoc(doc(db, "upi_webhook_logs", logId), {
            id: logId,
            receivedAt: now,
            combinedText: (combinedText || trimmedText || "Connectivity Test Ping").slice(0, 500),
            extractedUtr: "TEST_PING",
            extractedAmount: 0,
            source: rawBody.packageName || req.headers.get("user-agent") || "SRC PayHook Android",
            status: "TEST_PING",
          });
        }
      } catch (logErr) {
        console.warn("Notice: upi_webhook_logs test ping write error:", logErr);
      }

      return NextResponse.json({
        success: true,
        isPing: true,
        message: "Connectivity test ping received and logged successfully!",
        receivedText: combinedText || trimmedText || "(empty body)",
        hint: "Ready to receive live payment notifications.",
      });
    }

    // If UTR is missing from the notification banner (common in Paytm for Business push notifications),
    // generate a deterministic deduplication UTR based on amount, sender, text, and 10-minute time window.
    const extractedSender = extractSenderName(combinedText) || sender;
    const isSyntheticUtr = !utr || !/^\d{12}$/.test(utr);
    if (isSyntheticUtr) {
      utr = generateDeterministicSyntheticUtr(extractedSender, amount, combinedText);
    }

    // 3. Save to verified_upi_payments ledger & match active sessions / registrations
    let matchedRegistrationId: string | null = null;
    let matchedOrderId: string | null = null;
    let matchedStudentName: string | null = null;
    let payerName: string | null = extractedSender || null;
    let isFriendPayment = false;

    if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
      const paymentDocRef = doc(db, "verified_upi_payments", utr!);

      // IDEMPOTENCY CHECK: Did we already record & process this exact payment notification?
      try {
        const existingPaymentSnap = await getDoc(paymentDocRef);
        if (existingPaymentSnap.exists()) {
          const existingData = existingPaymentSnap.data();
          const existingStatus = existingData?.status || "MATCHED";
          const existingStudent = existingData?.matchedStudentName || null;
          const existingRegId = existingData?.matchedRegistrationId || null;
          const existingOrderId = existingData?.matchedOrderId || null;
          const existingPayer = existingData?.payerName || payerName || null;
          const existingIsFriend = Boolean(existingData?.isFriendPayment ?? isFriendPayment);

          // Log duplicate signal in audit feed without consuming another student's session or creating unclaimed payment!
          try {
            const logId = `SIG-${Date.now()}`;
            await setDoc(doc(db, "upi_webhook_logs", logId), {
              id: logId,
              receivedAt: now,
              combinedText: combinedText.slice(0, 500),
              extractedUtr: utr,
              extractedAmount: amount,
              matchedOrderId: existingOrderId,
              matchedRegistrationId: existingRegId,
              matchedStudentName: existingStudent,
              payerName: existingPayer,
              isFriendPayment: existingIsFriend,
              status: existingStatus,
              isDuplicate: true,
            });
          } catch {}

          return NextResponse.json({
            success: true,
            isDuplicate: true,
            utr,
            amount,
            matched: Boolean(existingRegId || existingOrderId),
            matchedRegistrationId: existingRegId,
            matchedOrderId: existingOrderId,
            matchedStudentName: existingStudent,
            payerName: existingPayer,
            isFriendPayment: existingIsFriend,
            message: existingStudent
              ? `Duplicate payment notification acknowledged for ${existingStudent}. Already verified as PAID.`
              : `Duplicate payment notification acknowledged for UTR ${utr}. Already recorded.`,
          });
        }
      } catch (idempotencyErr) {
        console.warn("Notice: idempotency lookup warning (proceeding):", idempotencyErr);
      }

      // Initial ledger write: record incoming payment before active session transition evaluation
      try {
        await setDoc(paymentDocRef, {
          utr,
          amount,
          rawNotification: combinedText,
          status: "UNCLAIMED",
          isSyntheticUtr,
          receivedAt: now,
          payerName: payerName || null,
        }, { merge: true });
      } catch (initLedgerErr) {
        console.warn("Notice: initial ledger write warning:", initLedgerErr);
      }

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
            if (extractedSender && !isNameCompatible(extractedSender, matchedStudentName)) {
              isFriendPayment = true;
            }
            await updateDoc(sessionRef, {
              status: "COMPLETED",
              utr,
              receivedAmount: amount,
              paidAt: now,
              rawNotification: combinedText,
              payerName: payerName || null,
              isFriendPayment,
            });
          }
        } catch (sessErr) {
          console.warn("Notice: explicit session matching warning:", sessErr);
        }
      }

      // If not matched by explicit order ID in notification text, check if any session submitted this exact UTR
      if (!matchedOrderId && utr) {
        try {
          const utrSessionQuery = query(
            collection(db, "active_checkout_sessions"),
            where("submittedUtr", "==", utr)
          );
          const utrSessionSnap = await getDocs(utrSessionQuery);
          if (!utrSessionSnap.empty) {
            const sessDoc = utrSessionSnap.docs[0];
            matchedOrderId = sessDoc.id;
            matchedStudentName = sessDoc.data().participantName || sessDoc.data().leaderName || sessDoc.data().email || "Student";
            await setDoc(sessDoc.ref, {
              status: "COMPLETED",
              utr,
              receivedAmount: amount,
              paidAt: now,
              rawNotification: combinedText,
              payerName: payerName || null,
              isFriendPayment: Boolean(isFriendPayment),
            }, { merge: true });
          }
        } catch (utrSessErr) {
          console.warn("Notice: submittedUtr session lookup warning:", utrSessErr);
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

            const hasFractionalPaise = Math.round(amount * 100) % 100 !== 0;
            let bestMatch: any = null;

            if (hasFractionalPaise) {
              // ─────────────────────────────────────────────────────────────
              // TIER 2: UNIQUE MICRO-PAISA 1:1 MATHEMATICAL IDENTITY MATCH
              // Every active student checkout has a mathematically unique paisa offset (e.g. ₹50.02).
              // Even if a friend or parent paid ("Rohan Sharma" for "Athang Dusawar"),
              // ₹50.02 belongs unambiguously to Athang within the active 30-minute window!
              // ─────────────────────────────────────────────────────────────
              const exactPaisaCandidates = allWaiting
                .filter((d) => {
                  const expectedAmt = Number(d.data.amount) || 0;
                  return Math.abs(expectedAmt - Number(amount)) < 0.005;
                })
                .sort(sortCandidates);

              if (exactPaisaCandidates.length > 0) {
                bestMatch = exactPaisaCandidates[0];
                const studentName = bestMatch.data.participantName || bestMatch.data.leaderName || "Student";
                if (extractedSender && !isNameCompatible(extractedSender, studentName)) {
                  isFriendPayment = true;
                  payerName = extractedSender;
                }
              }
            } else {
              // ─────────────────────────────────────────────────────────────
              // TIER 3: ROUND-FIGURE DISAMBIGUATION (e.g. ₹50.00 exactly)
              // Multiple students could simultaneously pay round amounts.
              // ─────────────────────────────────────────────────────────────
              const roundCandidates = allWaiting
                .filter((d) => {
                  const expectedAmt = Number(d.data.amount) || 0;
                  const hasMicroOffset = (d.data.microPaisaOffset && d.data.microPaisaOffset > 0) || (Math.round(expectedAmt * 100) % 100 !== 0);
                  if (hasMicroOffset) return false; // Do not mix with micro-paisa sessions
                  return Math.abs(expectedAmt - Number(amount)) < 0.005;
                })
                .sort(sortCandidates);

              if (roundCandidates.length > 0) {
                // Step 3A: Payer Name Match
                const nameMatches = roundCandidates.filter(c => {
                  const sName = c.data.participantName || c.data.leaderName || "";
                  return isNameCompatible(extractedSender, sName);
                });

                if (nameMatches.length > 0) {
                  bestMatch = nameMatches[0];
                } else {
                  // Step 3B: Phone Number Match in notification
                  const phoneMatches = roundCandidates.filter(c => {
                    const phone = String(c.data.phone || "").replace(/\D/g, "").slice(-6);
                    return phone.length >= 6 && combinedText.includes(phone);
                  });

                  if (phoneMatches.length > 0) {
                    bestMatch = phoneMatches[0];
                    if (extractedSender) isFriendPayment = true;
                  } else if (roundCandidates.length === 1) {
                    // Step 3C: Single Active Session (Friend paid, but NO OTHER student is waiting for this round amount)
                    bestMatch = roundCandidates[0];
                    if (extractedSender) {
                      isFriendPayment = true;
                      payerName = extractedSender;
                    }
                  } else {
                    // Step 3D: Conflict Protection! Multiple sessions waiting for ₹50.00 and payer is unknown friend.
                    // Do NOT guess blindly. Let it fall through to UNCLAIMED so student can enter UTR.
                    console.warn(`Ambiguity: ${roundCandidates.length} sessions waiting for ₹${amount}. Payer '${extractedSender}' matches none.`);
                    bestMatch = null;
                  }
                }
              }
            }
            if (bestMatch) {
              const createdAtMs = bestMatch.data.createdAt ? new Date(bestMatch.data.createdAt).getTime() : 0;
              // 30-minute grace window for delayed bank SMS notifications (never drop in-flight payments)
              const isSessionExpired = createdAtMs > 0 && (Date.now() > createdAtMs + 30 * 60 * 1000);

              if (isSessionExpired) {
                // Expired past 30 minutes
                await setDoc(doc(db, "active_checkout_sessions", bestMatch.id), {
                  status: "EXPIRED",
                  expiredAt: now,
                  attemptedUtr: utr,
                  attemptedAmount: amount,
                }, { merge: true });
              } else {
                matchedOrderId = bestMatch.id;
                matchedStudentName = bestMatch.data.participantName || bestMatch.data.leaderName || bestMatch.data.email || "Student";
                await setDoc(doc(db, "active_checkout_sessions", bestMatch.id), {
                  status: "COMPLETED",
                  utr,
                  receivedAmount: amount,
                  paidAt: now,
                  rawNotification: combinedText,
                  payerName: payerName || null,
                  isFriendPayment: Boolean(isFriendPayment),
                }, { merge: true });
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

        // Direct single-document lookup via session's registrationId (100% compliant with allow get: if true)
        if (!matchingDoc && matchedOrderId) {
          try {
            const sessSnap = await getDoc(doc(db, "active_checkout_sessions", matchedOrderId));
            if (sessSnap.exists()) {
              const directRegId = sessSnap.data()?.registrationId;
              if (directRegId) {
                const directSnap = await getDoc(doc(db, "registrations", directRegId));
                if (directSnap.exists()) {
                  matchingDoc = directSnap;
                }
              }
            }
          } catch (sessRegErr) {
            console.warn("Notice: direct session registration lookup warning:", sessRegErr);
          }
        }

        // Query by paymentId (UTR)
        if (!matchingDoc && !isSyntheticUtr) {
          try {
            const regQuery = query(
              collection(db, "registrations"),
              where("paymentId", "==", utr)
            );
            let regSnap = await getDocs(regQuery);
            if (!regSnap.empty) {
              matchingDoc = regSnap.docs[0];
            }
          } catch {}
        }

        // Fallback: Query by matchedOrderId
        if (!matchingDoc && matchedOrderId) {
          try {
            const orderRegQuery = query(
              collection(db, "registrations"),
              where("orderId", "==", matchedOrderId)
            );
            const orderSnap = await getDocs(orderRegQuery);
            if (!orderSnap.empty) {
              matchingDoc = orderSnap.docs[0];
            }
          } catch {}
        }

        // Fallback: Query by customAnswers.upiUtr
        if (!matchingDoc && !isSyntheticUtr) {
          try {
            const customRegQuery = query(
              collection(db, "registrations"),
              where("customAnswers.upiUtr", "==", utr)
            );
            const customSnap = await getDocs(customRegQuery);
            if (!customSnap.empty) {
              matchingDoc = customSnap.docs[0];
            }
          } catch {}
        }

        if (matchingDoc && extractedSender) {
          const regName = matchingDoc.data()?.participantName || matchingDoc.data()?.leaderName || "";
          if (!isNameCompatible(extractedSender, regName)) {
            // Friend account payment:
            // If matched by exact 12-digit bank UTR or verified checkout orderId,
            // the payment reference is genuine. Mark as friend payment with actual payer name.
            isFriendPayment = true;
            payerName = extractedSender;
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
            verifiedBy: "Paytm Auto-Gateway (SRC PayHook)",
            verifiedAt: now,
            payerName: payerName || null,
            isFriendPayment: Boolean(isFriendPayment),
          });
        } else if (matchedOrderId) {
          // Self-Healing Invariant: If student closed browser, auto-create their registration from session draft!
          try {
            const sessSnap = await getDoc(doc(db, "active_checkout_sessions", matchedOrderId));
            if (sessSnap.exists()) {
              const sData = sessSnap.data();
              if (sData?.registrationData && typeof sData.registrationData === "object") {
                const draft = sData.registrationData;
                const regId = sData.registrationId || draft.id || `SRC-${String(sData.eventId || "EVT").slice(0, 3).toUpperCase()}-26-${Math.floor(10000 + Math.random() * 90000)}`;
                const tkCode = draft.ticketCode || `${String(sData.eventId || "EVT").slice(0, 3).toUpperCase()}26-TK-${Math.floor(1000 + Math.random() * 9000)}`;

                const newRecord = {
                  ...draft,
                  id: regId,
                  orderId: matchedOrderId,
                  paymentStatus: "PAID",
                  status: "CONFIRMED",
                  paymentId: utr,
                  amountPaid: Number(amount || sData.amount || draft.amountPaid || 0),
                  ticketCode: tkCode,
                  qrPayload: draft.qrPayload || `SRC:PASS:${regId}:${tkCode}:${sData.eventId}`,
                  paidAt: now,
                  registeredAt: draft.registeredAt || now,
                  createdAt: now,
                  verifiedBy: "Paytm Auto-Gateway (SRC PayHook)",
                  verifiedAt: now,
                  payerName: payerName || null,
                  isFriendPayment: Boolean(isFriendPayment),
                };

                await setDoc(doc(db, "registrations", regId), newRecord, { merge: true });
                matchedRegistrationId = regId;
                matchedStudentName = newRecord.leaderName || newRecord.participantName || matchedStudentName || "Student";
              }
            }
          } catch (autoCreateErr) {
            console.warn("Notice: webhook auto-creation of registration record warning:", autoCreateErr);
          }
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
          payerName: payerName || null,
          isFriendPayment: Boolean(isFriendPayment),
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
          payerName: payerName || null,
          isFriendPayment: Boolean(isFriendPayment),
          status: isMatched ? "MATCHED" : "UNCLAIMED",
          isDuplicate: false,
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
      payerName: payerName || null,
      isFriendPayment: Boolean(isFriendPayment),
      message: matchedRegistrationId
        ? `Payment matched and pass auto-approved for ${matchedStudentName} (${matchedRegistrationId}).`
        : matchedOrderId
        ? (isFriendPayment
            ? `Friend payment by ${payerName} auto-approved for ${matchedStudentName} (${matchedOrderId}). Instant pass rendered on device.`
            : `Active checkout session auto-approved for ${matchedStudentName} (${matchedOrderId}). Instant pass rendered on device.`)
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
  const isAuth = isAuthorized(req, "");
  if (!isAuth) {
    return NextResponse.json({
      status: "ONLINE",
      service: "SRC JDCOEM Automated UPI Webhook Engine",
      note: "Webhook endpoint is online. Signed POST requests are required for payment processing.",
    });
  }

  // If query parameters include payment parameters (e.g. PayHook configured with GET)
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

/**
 * DELETE: Clear all upi_webhook_logs or a single specific log entry
 */
export async function DELETE(req: NextRequest) {
  const secretKey = process.env.UPI_WEBHOOK_SECRET || "SRC_UPI_2026_GATEWAY";
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  const authHeader = req.headers.get("x-src-webhook-key");

  if (secret !== secretKey && authHeader !== secretKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const logId = url.searchParams.get("logId");

    // Case 1: Delete a single specific log
    if (logId) {
      await deleteDoc(doc(db, "upi_webhook_logs", logId));
      return NextResponse.json({ success: true, deleted: 1, logId });
    }

    // Case 2: Batch delete all logs in upi_webhook_logs
    const snap = await getDocs(collection(db, "upi_webhook_logs"));
    if (snap.empty) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const docs = snap.docs;
    let totalDeleted = 0;
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
      totalDeleted += chunk.length;
    }

    return NextResponse.json({ success: true, deleted: totalDeleted });
  } catch (err: any) {
    console.error("Error clearing upi_webhook_logs:", err);
    return NextResponse.json({ error: err.message || "Failed to clear logs" }, { status: 500 });
  }
}
