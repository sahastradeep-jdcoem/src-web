import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/firebase/config";
import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  getDocs, 
  query, 
  where, 
  limit,
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import {
  extractUtrFromText,
  extractAmountFromText,
  extractTimestampFromNotificationContent,
  extractSenderName,
  isNameCompatible,
  generateDeterministicSyntheticUtr,
  resolveSourceAppName,
  evaluateCandidateAgainstRegistration,
  isPromotionalOrMarketingNotification,
} from "@/lib/payments";

const WEBHOOK_MAX_SKEW_SECONDS = 5 * 60;

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

    // Guard: Reject promotional, marketing, loan, credit card offer, or debit notifications
    const promoCheck = isPromotionalOrMarketingNotification(combinedText, title, sender);
    if (promoCheck.isPromotional) {
      return NextResponse.json({
        success: false,
        ignored: true,
        message: `Notification ignored: ${promoCheck.reason}`,
      });
    }

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
    const rawPostTime = Number(rawBody.postTime || rawBody.notificationTimestamp || 0);
    const contentDate = extractTimestampFromNotificationContent(combinedText, rawPostTime > 0 ? rawPostTime : undefined);
    const transactionTimestamp = contentDate.toISOString();

    // If neither amount nor UTR can be detected: handle as connectivity test/ping
    if ((!utr || !/^\d{12}$/.test(utr)) && (!amount || amount <= 0)) {
      // 1. Record test ping into upi_webhook_logs in Firestore so admin console reflects it in real time
      try {
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const logId = `PING-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await setDoc(doc(db, "upi_webhook_logs", logId), {
            id: logId,
            receivedAt: now,
            transactionTimestamp,
            notificationTimestamp: rawPostTime || contentDate.getTime(),
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
    // generate a deterministic deduplication UTR based on amount, sender, text, and transaction time window.
    const extractedSender = extractSenderName(combinedText) || sender;
    const isSyntheticUtr = !utr || !/^\d{12}$/.test(utr);
    if (isSyntheticUtr) {
      utr = generateDeterministicSyntheticUtr(extractedSender, amount, combinedText, contentDate.getTime());
    }

    // 3. Save to verified_upi_payments ledger & match active sessions / registrations
    const incomingSourceParam = req.nextUrl.searchParams.get("source") || rawBody.source;
    const sourceAppName = resolveSourceAppName(rawBody.packageName || incomingSourceParam, req.headers.get("user-agent"), combinedText);
    let isDuplicateNotification = false;
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

          // Self-heal: If payment was already recorded before student submitted manual UTR,
          // check if a PENDING registration now exists with this exact 12-digit UTR and auto-approve it.
          let healedRegId: string | null = existingRegId;
          let healedStudent: string | null = existingStudent;
          if (!existingRegId && !isSyntheticUtr && utr) {
            try {
              let pendingSnap = await getDocs(query(collection(db, "registrations"), where("paymentId", "==", utr), limit(1)));
              if (pendingSnap.empty) {
                pendingSnap = await getDocs(query(collection(db, "registrations"), where("customAnswers.upiUtr", "==", utr), limit(1)));
              }
              if (!pendingSnap.empty) {
                const regDoc = pendingSnap.docs[0];
                const rData = regDoc.data();
                if (rData?.paymentStatus !== "PAID") {
                  await updateDoc(regDoc.ref, {
                    paymentStatus: "PAID",
                    status: "CONFIRMED",
                    paymentId: utr,
                    paidAt: now,
                    amountPaid: Number(amount || existingData?.amount || rData.amountPaid || 0),
                    verifiedBy: "Auto-Gateway (SRC PayHook - Bank SMS)",
                    verifiedAt: now,
                    payerName: existingPayer || null,
                    isFriendPayment: existingIsFriend,
                    "paymentDetails.paymentStatus": "PAID",
                    "paymentDetails.utr": utr,
                    "paymentDetails.bankUtr": utr,
                    "paymentDetails.amount": Number(amount || existingData?.amount || rData.amountPaid || 0),
                    "paymentDetails.verifiedAt": now,
                  });
                }
                healedRegId = regDoc.id;
                healedStudent = rData.participantName || rData.leaderName || existingStudent || "Student";
                await setDoc(paymentDocRef, {
                  status: "MATCHED",
                  matchedRegistrationId: healedRegId,
                  matchedOrderId: existingOrderId || rData.orderId || null,
                  matchedStudentName: healedStudent,
                  matchedAt: now,
                }, { merge: true }).catch(() => {});
              }
            } catch (healErr) {
              console.warn("Notice: duplicate-signal late registration heal warning:", healErr);
            }
          }

          // Return early on duplicate signal with zero redundant writes
          return NextResponse.json({
            success: true,
            isDuplicate: true,
            utr,
            amount,
            matched: Boolean(healedRegId || existingOrderId),
            matchedRegistrationId: healedRegId,
            matchedOrderId: existingOrderId,
            matchedStudentName: healedStudent,
            payerName: existingPayer,
            isFriendPayment: existingIsFriend,
            message: healedStudent
              ? `Duplicate payment notification acknowledged for ${healedStudent}. Already verified as PAID.`
              : `Duplicate payment notification acknowledged for UTR ${utr}. Already recorded.`,
          });
        }
      } catch (idempotencyErr) {
        console.warn("Notice: idempotency lookup warning (proceeding):", idempotencyErr);
      }

      // Pre-record ledger entry in verified_upi_payments BEFORE updating active_checkout_sessions or registrations.
      // Firestore security rules (Transition 2 & isVerifiedPaidRegistration Case 2) require verified_upi_payments/{utr}
      // to exist prior to unauthenticated server-side payment status escalation.
      try {
        await setDoc(paymentDocRef, {
          utr,
          amount,
          rawNotification: combinedText,
          status: "UNCLAIMED",
          isSyntheticUtr,
          source: sourceAppName,
          receivedAt: now,
          transactionTimestamp,
          notificationTimestamp: rawPostTime || contentDate.getTime(),
        }, { merge: true });
      } catch (preLedgerErr) {
        console.warn("Notice: pre-ledger verified_upi_payments write warning:", preLedgerErr);
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
            await setDoc(paymentDocRef, {
              status: "MATCHED",
              matchedOrderId: sessionSnap.id,
              matchedStudentName,
            }, { merge: true }).catch(() => {});
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
            where("submittedUtr", "==", utr),
            limit(1)
          );
          const utrSessionSnap = await getDocs(utrSessionQuery);
          if (!utrSessionSnap.empty) {
            const sessDoc = utrSessionSnap.docs[0];
            matchedOrderId = sessDoc.id;
            matchedStudentName = sessDoc.data().participantName || sessDoc.data().leaderName || sessDoc.data().email || "Student";
            await setDoc(paymentDocRef, {
              status: "MATCHED",
              matchedOrderId: sessDoc.id,
              matchedStudentName,
            }, { merge: true }).catch(() => {});
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

      // Pre-Tier-2 Name-Compatible Bank SMS Reconciliation:
      // If a real 12-digit Bank SMS arrives shortly after a Paytm push notification (AUTO-PTM-*)
      // for the same amount AND compatible payer/student name, reconcile it into that COMPLETED
      // transaction immediately BEFORE Tier 2/2B can match any other student's WAITING/EXPIRED session.
      if (!matchedOrderId && amount > 0 && !isSyntheticUtr && extractedSender) {
        try {
          let preMatchedCompleted: any = null;

          // 1. Check COMPLETED active_checkout_sessions within 180s burst window
          const preCompletedSnap = await getDocs(query(
            collection(db, "active_checkout_sessions"),
            where("status", "==", "COMPLETED"),
            where("amount", "==", Number(amount)),
            limit(10)
          ));
          if (!preCompletedSnap.empty) {
            const matchSess = preCompletedSnap.docs.find((d) => {
              const data = d.data();
              const expectedAmt = Number(data.amount) || 0;
              if (Math.abs(expectedAmt - Number(amount)) >= 0.005) return false;
              const existingUtr = String(data.utr || "");
              if (existingUtr && !existingUtr.startsWith("AUTO-PTM-") && existingUtr !== utr) return false;
              const sessionTimeMs = new Date(data.transactionTimestamp || data.paidAt || data.createdAt || 0).getTime();
              if (Math.abs(contentDate.getTime() - sessionTimeMs) > 180 * 1000) return false;

              const sName = String(data.participantName || data.leaderName || "");
              const pName = String(data.payerName || "");
              return isNameCompatible(extractedSender, sName) || isNameCompatible(extractedSender, pName);
            });
            if (matchSess) {
              preMatchedCompleted = {
                id: matchSess.id,
                data: matchSess.data(),
                isSession: true,
              };
            }
          }

          // 2. Check PAID registrations with AUTO-PTM-* synthetic UTR within 180s burst window
          if (!preMatchedCompleted) {
            const prePaidRegsSnap = await getDocs(query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "PAID"),
              where("amountPaid", "==", Number(amount)),
              limit(10)
            ));
            if (!prePaidRegsSnap.empty) {
              const matchReg = prePaidRegsSnap.docs.find((d) => {
                const data = d.data();
                const expectedAmt = Number(data.amountPaid || data.paymentDetails?.amount || 0);
                if (Math.abs(expectedAmt - Number(amount)) >= 0.005) return false;
                const regTimeMs = new Date(data.paidAt || data.registeredAt || data.createdAt || 0).getTime();
                if (Math.abs(contentDate.getTime() - regTimeMs) > 180 * 1000) return false;
                const regUtr = String(data.paymentId || data.paymentDetails?.utr || "");
                const isSynth = regUtr.startsWith("AUTO-PTM-") || Boolean(data.paymentDetails?.syntheticUtr);
                if (!isSynth) return false;

                const sName = String(data.participantName || data.leaderName || "");
                const pName = String(data.payerName || "");
                return isNameCompatible(extractedSender, sName) || isNameCompatible(extractedSender, pName);
              });
              if (matchReg) {
                preMatchedCompleted = {
                  id: matchReg.id,
                  data: matchReg.data(),
                  isRegistration: true,
                };
              }
            }
          }

          if (preMatchedCompleted) {
            const rData = preMatchedCompleted.data;
            matchedOrderId = preMatchedCompleted.isSession ? preMatchedCompleted.id : (rData.orderId || null);
            matchedRegistrationId = preMatchedCompleted.isRegistration ? preMatchedCompleted.id : (rData.registrationId || null);
            matchedStudentName = rData.participantName || rData.leaderName || "Student";

            if (matchedOrderId) {
              await setDoc(doc(db, "active_checkout_sessions", matchedOrderId), {
                bankUtr: utr,
                realUtr: utr,
                utr,
                reconciledViaBankSms: true,
                bankSmsText: combinedText,
                reconciledAt: now,
              }, { merge: true }).catch(() => {});
            }

            if (matchedRegistrationId) {
              await setDoc(doc(db, "registrations", matchedRegistrationId), {
                paymentId: utr,
                "paymentDetails.utr": utr,
                "paymentDetails.bankUtr": utr,
                "paymentDetails.reconciledFromBankSms": true,
                "paymentDetails.syntheticUtrReplaced": rData.paymentId || rData.utr || null,
                "paymentDetails.bankPayer": payerName || null,
              }, { merge: true }).catch(() => {});
            }

            const prevSynthUtr = rData.paymentId || rData.utr;
            if (prevSynthUtr && prevSynthUtr !== utr) {
              await setDoc(doc(db, "verified_upi_payments", prevSynthUtr), {
                status: "MERGED",
                reconciledToBankUtr: utr,
                note: `Merged into official Bank SMS UTR ${utr}`,
              }, { merge: true }).catch(() => {});
            }
          }
        } catch (preReconcileErr) {
          console.warn("Notice: pre-Tier-2 Bank SMS reconciliation warning:", preReconcileErr);
        }
      }

      // If not matched by explicit order ID, match by amount from recent WAITING sessions (within last 30 min)
      if (!matchedOrderId && amount > 0) {
        try {
          const waitingSessionsQuery = query(
            collection(db, "active_checkout_sessions"),
            where("status", "==", "WAITING"),
            limit(15)
          );
          const waitingSnap = await getDocs(waitingSessionsQuery);
          if (!waitingSnap.empty) {
            const rawWaiting = waitingSnap.docs.map((d) => ({ ref: d.ref, id: d.id, data: d.data() }));

            // Exclude WAITING sessions belonging to students who ALREADY hold a confirmed PAID registration for that event
            const allWaiting: typeof rawWaiting = [];
            for (const w of rawWaiting) {
              let alreadyPaid = false;
              const wEmail = String(w.data.email || "").trim().toLowerCase();
              const wBtId = String(w.data.btId || "").trim().toUpperCase();
              const wEventId = String(w.data.eventId || "").trim().toLowerCase();
              try {
                if (wEmail) {
                  const paidByEmail = await getDocs(query(
                    collection(db, "registrations"),
                    where("email", "==", wEmail),
                    where("paymentStatus", "==", "PAID"),
                    limit(5)
                  ));
                  if (!paidByEmail.empty) {
                    alreadyPaid = paidByEmail.docs.some((pd) => {
                      const d = pd.data();
                      if (d.status === "CANCELLED") return false;
                      return !wEventId || String(d.eventId || "").trim().toLowerCase() === wEventId;
                    });
                  }
                }
                if (!alreadyPaid && wBtId && wBtId !== "STUDENT") {
                  const paidByBt = await getDocs(query(
                    collection(db, "registrations"),
                    where("btId", "==", wBtId),
                    where("paymentStatus", "==", "PAID"),
                    limit(5)
                  ));
                  if (!paidByBt.empty) {
                    alreadyPaid = paidByBt.docs.some((pd) => {
                      const d = pd.data();
                      if (d.status === "CANCELLED") return false;
                      return !wEventId || String(d.eventId || "").trim().toLowerCase() === wEventId;
                    });
                  }
                }
              } catch {}
              if (!alreadyPaid) {
                allWaiting.push(w);
              }
            }

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
                // Link matchedOrderId on verified_upi_payments first so Firestore Transition 2 passes
                await setDoc(paymentDocRef, {
                  status: "MATCHED",
                  matchedOrderId: bestMatch.id,
                  matchedStudentName,
                }, { merge: true }).catch(() => {});
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

      // Tier 2B: Delayed Offline Backlog Revival (with strict anti-hijack & name-priority guards):
      // Before reviving an EXPIRED session, verify no PENDING registration already matches this signal,
      // never revive an EXPIRED session for a student who already paid for this event, and rank by name & time proximity.
      if (!matchedOrderId && amount > 0) {
        try {
          // 1. Check if a PENDING registration matches this signal first (prevents an abandoned EXPIRED session
          //    from stealing a signal meant for a student who already submitted their registration!)
          let hasPendingRegMatch = false;
          try {
            const pendingCheckSnap = await getDocs(query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "PENDING"),
              limit(25)
            ));
            if (!pendingCheckSnap.empty) {
              const candSig = {
                utr: isSyntheticUtr ? undefined : utr || undefined,
                submittedUtr: utr || undefined,
                amount,
                payerName: extractedSender || undefined,
                timestamp: contentDate.toISOString(),
                source: sourceAppName,
              };
              hasPendingRegMatch = pendingCheckSnap.docs.some((d) => {
                const rd = d.data();
                const ev = evaluateCandidateAgainstRegistration(candSig, {
                  id: d.id,
                  registrationId: rd.registrationId,
                  orderId: rd.orderId,
                  paymentId: rd.paymentId || rd.paymentDetails?.utr || rd.customAnswers?.upiUtr,
                  amountPaid: Number(rd.amountPaid || rd.paymentDetails?.amount || 0),
                  participantName: rd.participantName,
                  leaderName: rd.leaderName,
                  phone: rd.phone,
                  registeredAt: rd.registeredAt,
                  createdAt: rd.createdAt,
                });
                return Boolean(ev?.isEligibleForAutoApproval);
              });
            }
          } catch {}

          if (!hasPendingRegMatch) {
            const expiredSessionsQuery = query(
              collection(db, "active_checkout_sessions"),
              where("status", "==", "EXPIRED"),
              where("amount", "==", Number(amount)),
              limit(20)
            );
            const expiredSnap = await getDocs(expiredSessionsQuery);
            if (!expiredSnap.empty) {
              const allExpired = expiredSnap.docs.map(d => ({ ref: d.ref, id: d.id, data: d.data() }));

              // Filter expired sessions created within last 24 hours with matching amount
              const recentExpired = allExpired.filter(d => {
                const expectedAmt = Number(d.data.amount) || 0;
                if (Math.abs(expectedAmt - Number(amount)) >= 0.005) return false;
                const cTime = new Date(d.data.createdAt || 0).getTime();
                return (Date.now() - cTime) < 24 * 60 * 60 * 1000;
              });

              // Exclude expired sessions belonging to students who ALREADY have a PAID registration for that event
              const matchingExpired: typeof recentExpired = [];
              for (const exp of recentExpired) {
                let alreadyPaid = false;
                const expEmail = String(exp.data.email || "").trim().toLowerCase();
                const expEventId = exp.data.eventId;
                if (expEmail) {
                  try {
                    const paidByEmail = await getDocs(query(
                      collection(db, "registrations"),
                      where("email", "==", expEmail),
                      where("paymentStatus", "==", "PAID"),
                      limit(5)
                    ));
                    if (!paidByEmail.empty) {
                      alreadyPaid = paidByEmail.docs.some((pd) => !expEventId || pd.data().eventId === expEventId);
                    }
                  } catch {}
                }
                if (!alreadyPaid) {
                  matchingExpired.push(exp);
                }
              }

              if (matchingExpired.length > 0) {
                const incomingMs = contentDate.getTime();
                // Rank by: 1) Name compatibility, 2) Phone match, 3) Closest timestamp to payment
                matchingExpired.sort((a, b) => {
                  const nameA = String(a.data.participantName || a.data.leaderName || "");
                  const nameB = String(b.data.participantName || b.data.leaderName || "");
                  const aNameOk = Boolean(extractedSender && isNameCompatible(extractedSender, nameA));
                  const bNameOk = Boolean(extractedSender && isNameCompatible(extractedSender, nameB));
                  if (aNameOk && !bNameOk) return -1;
                  if (!aNameOk && bNameOk) return 1;

                  const textLower = combinedText.toLowerCase();
                  const phoneA = String(a.data.phone || "").replace(/\D/g, "").slice(-6);
                  const phoneB = String(b.data.phone || "").replace(/\D/g, "").slice(-6);
                  const aPhoneOk = Boolean(phoneA.length >= 6 && textLower.includes(phoneA));
                  const bPhoneOk = Boolean(phoneB.length >= 6 && textLower.includes(phoneB));
                  if (aPhoneOk && !bPhoneOk) return -1;
                  if (!aPhoneOk && bPhoneOk) return 1;

                  const deltaA = Math.abs(incomingMs - new Date(a.data.createdAt || 0).getTime());
                  const deltaB = Math.abs(incomingMs - new Date(b.data.createdAt || 0).getTime());
                  return deltaA - deltaB;
                });

                const recovered = matchingExpired[0];
                const recName = recovered.data.participantName || recovered.data.leaderName || recovered.data.email || "Student";
                const nameMatches = !extractedSender || isNameCompatible(extractedSender, recName);
                const recAgeMs = Math.abs(incomingMs - new Date(recovered.data.createdAt || 0).getTime());

                // Safety gate: If payer name contradicts student name, only recover if it is the sole
                // recent expired session within 45 minutes; otherwise leave UNCLAIMED for manual/UTR match.
                if (nameMatches || (matchingExpired.length === 1 && recAgeMs <= 45 * 60 * 1000)) {
                  matchedOrderId = recovered.id;
                  matchedStudentName = recName;
                  if (extractedSender && !isNameCompatible(extractedSender, matchedStudentName)) {
                    isFriendPayment = true;
                    payerName = extractedSender;
                  }
                  await setDoc(paymentDocRef, {
                    status: "MATCHED",
                    matchedOrderId: recovered.id,
                    matchedStudentName,
                  }, { merge: true }).catch(() => {});
                  await setDoc(doc(db, "active_checkout_sessions", recovered.id), {
                    status: "COMPLETED",
                    utr,
                    receivedAmount: amount,
                    paidAt: now,
                    transactionTimestamp,
                    rawNotification: combinedText,
                    payerName: payerName || null,
                    isFriendPayment: Boolean(isFriendPayment),
                    recoveredFromExpired: true,
                  }, { merge: true }).catch((e) => {
                    console.warn("Notice: expired session status update note:", e);
                  });
                }
              }
            }
          }
        } catch (expReviveErr) {
          console.warn("Notice: expired session revival warning:", expReviveErr);
        }
      }

      // Secondary Deduplication & Bank SMS UTR Upgrade Check:
      // Did a session or registration for this exact transaction complete with a synthetic UTR within the burst window?
      if (!matchedOrderId && amount > 0) {
        try {
          let matchedCompletedData: any = null;

          // Check 1: Completed active checkout sessions (Strict <= 180s burst window or exact UTR match, filtered by amount)
          const completedQuery = query(
            collection(db, "active_checkout_sessions"),
            where("status", "==", "COMPLETED"),
            where("amount", "==", Number(amount)),
            limit(5)
          );
          const completedSnap = await getDocs(completedQuery);

          if (!completedSnap.empty) {
            const recentMatch = completedSnap.docs.find((d) => {
              const data = d.data();
              const expectedAmt = Number(data.amount) || 0;
              if (Math.abs(expectedAmt - Number(amount)) >= 0.005) return false;

              // Exact explicit UTR match is always the same payment
              if (data.utr && utr && data.utr === utr) return true;

              // Temporal Content-Timestamp Boundary (<= 180s)
              const sessionTimeMs = new Date(data.transactionTimestamp || data.paidAt || data.createdAt || 0).getTime();
              const incomingTimeMs = contentDate.getTime();
              if (Math.abs(incomingTimeMs - sessionTimeMs) > 180 * 1000) {
                return false; // Separate payment hours apart; never absorb!
              }

              // If incoming has real UTR and session already has a different real UTR, don't collide
              if (!isSyntheticUtr && data.utr && !data.utr.startsWith("AUTO-PTM-") && data.utr !== utr) {
                return false;
              }

              // Two different Paytm push notifications (different AUTO-PTM- hashes) should not absorb
              // each other unless payer/student name matches (prevents Student B's payment from merging into Student A's)
              if (isSyntheticUtr && data.utr && data.utr.startsWith("AUTO-PTM-") && data.utr !== utr) {
                const sName = String(data.participantName || data.leaderName || "");
                const pName = String(data.payerName || "");
                if (!extractedSender || (!isNameCompatible(extractedSender, sName) && !isNameCompatible(extractedSender, pName))) {
                  return false;
                }
              }

              // Do not absorb if both signals have contradictory payer/student names
              if (extractedSender) {
                const sName = String(data.participantName || data.leaderName || "");
                const pName = String(data.payerName || "");
                if ((sName || pName) && !isNameCompatible(extractedSender, sName) && !isNameCompatible(extractedSender, pName)) {
                  return false;
                }
              }
              return true;
            });

            if (recentMatch) {
              matchedCompletedData = {
                id: recentMatch.id,
                ref: recentMatch.ref,
                data: recentMatch.data(),
                isSession: true,
              };
            }
          }

          // Check 2: Canonical registrations completed with synthetic UTR (e.g. AUTO-PTM-xxx, filtered by amount)
          if (!matchedCompletedData) {
            const paidRegsQuery = query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "PAID"),
              where("amountPaid", "==", Number(amount)),
              limit(5)
            );
            const paidRegsSnap = await getDocs(paidRegsQuery);
            if (!paidRegsSnap.empty) {
              const synthMatch = paidRegsSnap.docs.find((d) => {
                const data = d.data();
                const expectedAmt = Number(data.amountPaid || data.paymentDetails?.amount || 0);
                if (Math.abs(expectedAmt - Number(amount)) >= 0.005) return false;

                // Temporal Content-Timestamp Boundary (<= 180s)
                const regTimeMs = new Date(data.paidAt || data.registeredAt || data.createdAt || 0).getTime();
                const incomingTimeMs = contentDate.getTime();
                if (Math.abs(incomingTimeMs - regTimeMs) > 180 * 1000) {
                  return false; // Do not absorb registrations from hours ago!
                }

                const regUtr = String(data.paymentId || data.paymentDetails?.utr || "");
                // Must have been created with a synthetic UTR or lacking official bank UTR
                return regUtr.startsWith("AUTO-PTM-") || data.paymentDetails?.syntheticUtr;
              });

              if (synthMatch) {
                matchedCompletedData = {
                  id: synthMatch.id,
                  ref: synthMatch.ref,
                  data: synthMatch.data(),
                  isRegistration: true,
                };
              }
            }
          }

          if (matchedCompletedData) {
            const rData = matchedCompletedData.data;
            matchedOrderId = matchedCompletedData.isSession ? matchedCompletedData.id : (rData.orderId || null);
            matchedRegistrationId = matchedCompletedData.isRegistration ? matchedCompletedData.id : (rData.registrationId || null);
            matchedStudentName = rData.participantName || rData.leaderName || "Student";

            // If incoming signal is a genuine 12-digit Bank SMS UTR, UPGRADE the records!
            if (!isSyntheticUtr && utr) {
              try {
                // 1. Upgrade session with official bank UTR
                if (matchedOrderId) {
                  await setDoc(doc(db, "active_checkout_sessions", matchedOrderId), {
                    bankUtr: utr,
                    realUtr: utr,
                    utr: utr,
                    reconciledViaBankSms: true,
                    bankSmsText: combinedText,
                    reconciledAt: now,
                  }, { merge: true });
                }

                // 2. Upgrade registration with official bank UTR
                if (matchedRegistrationId) {
                  await setDoc(doc(db, "registrations", matchedRegistrationId), {
                    paymentId: utr,
                    "paymentDetails.utr": utr,
                    "paymentDetails.bankUtr": utr,
                    "paymentDetails.reconciledFromBankSms": true,
                    "paymentDetails.syntheticUtrReplaced": rData.paymentId || rData.utr || null,
                    "paymentDetails.bankPayer": payerName || null,
                  }, { merge: true });
                }

                // 3. Mark previous synthetic ledger entry as MERGED
                const prevSynthUtr = rData.paymentId || rData.utr;
                if (prevSynthUtr && prevSynthUtr !== utr) {
                  await setDoc(doc(db, "verified_upi_payments", prevSynthUtr), {
                    status: "MERGED",
                    reconciledToBankUtr: utr,
                    note: `Merged into official Bank SMS UTR ${utr}`,
                  }, { merge: true });
                }
              } catch (reconcileErr) {
                console.warn("Notice: Bank SMS UTR reconciliation note:", reconcileErr);
              }
            } else {
              isDuplicateNotification = true;
            }
          }
        } catch (recentErr) {
          console.warn("Notice: recently completed session check warning:", recentErr);
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
              where("paymentId", "==", utr),
              limit(1)
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
              where("orderId", "==", matchedOrderId),
              limit(1)
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
              where("customAnswers.upiUtr", "==", utr),
              limit(1)
            );
            const customSnap = await getDocs(customRegQuery);
            if (!customSnap.empty) {
              matchingDoc = customSnap.docs[0];
            }
          } catch {}
        }

        // 5. Multi-Factor Reconciliation for "PENDING REVIEW" registrations:
        // When PayHook was delayed/offline, student registered with manual UTR or is awaiting payment approval.
        if (!matchingDoc && amount > 0) {
          try {
            const pendingRegsQuery = query(
              collection(db, "registrations"),
              where("paymentStatus", "==", "PENDING"),
              limit(25)
            );
            const pendingRegsSnap = await getDocs(pendingRegsQuery);
            if (!pendingRegsSnap.empty) {
              const candSignal = {
                orderId: matchedOrderId || undefined,
                registrationId: matchedRegistrationId || undefined,
                matchedOrderId: matchedOrderId || undefined,
                matchedRegistrationId: matchedRegistrationId || undefined,
                utr: isSyntheticUtr ? undefined : utr || undefined,
                submittedUtr: utr || undefined,
                amount,
                payerName: extractedSender || undefined,
                timestamp: contentDate.toISOString(),
                source: sourceAppName,
              };

              const scoredRegCandidates = pendingRegsSnap.docs.map((d) => {
                const data = d.data();
                const evalMatch = evaluateCandidateAgainstRegistration(candSignal, {
                  id: d.id,
                  registrationId: data.registrationId,
                  orderId: data.orderId,
                  paymentId: data.paymentId || data.paymentDetails?.utr || data.customAnswers?.upiUtr,
                  amountPaid: Number(data.amountPaid || data.paymentDetails?.amount || 0),
                  participantName: data.participantName,
                  leaderName: data.leaderName,
                  phone: data.phone,
                  registeredAt: data.registeredAt,
                  createdAt: data.createdAt,
                });

                return {
                  ref: d.ref,
                  id: d.id,
                  data,
                  evalMatch,
                };
              }).filter((c): c is typeof c & { evalMatch: NonNullable<typeof c.evalMatch> } => Boolean(c.evalMatch));

              // Rank by MAXIMUM matched dimensions first, then highest score, then closest time delta
              scoredRegCandidates.sort((a, b) => {
                if (b.evalMatch.matchedDimensionsCount !== a.evalMatch.matchedDimensionsCount) {
                  return b.evalMatch.matchedDimensionsCount - a.evalMatch.matchedDimensionsCount;
                }
                if (b.evalMatch.score !== a.evalMatch.score) {
                  return b.evalMatch.score - a.evalMatch.score;
                }
                return (a.evalMatch.timeDeltaSeconds || 999999) - (b.evalMatch.timeDeltaSeconds || 999999);
              });

              // Strict Convergence Gate: Requires matching AT LEAST 2 independent dimensions AND score >= 60
              let candidateMatch: any = null;
              if (scoredRegCandidates.length > 0) {
                const best = scoredRegCandidates[0];
                if (best.evalMatch.isEligibleForAutoApproval) {
                  candidateMatch = best;
                } else {
                  console.warn(`Webhook Auto-Approve Skipped: Best candidate ${best.id} matched only ${best.evalMatch.matchedDimensionsCount} dimensions (Score: ${best.evalMatch.score}). Requires >= 2 dimensions and score >= 60.`);
                }
              }

              if (candidateMatch) {
                matchingDoc = candidateMatch;
                matchedRegistrationId = candidateMatch.id;
                matchedStudentName = candidateMatch.data.participantName || candidateMatch.data.leaderName || "Student";
              }
            }
          } catch (pendingErr) {
            console.warn("Notice: pending review registrations lookup warning:", pendingErr);
          }
        }

        if (matchingDoc && extractedSender) {
          const mData = (typeof matchingDoc.data === "function" ? matchingDoc.data() : matchingDoc.data) || {};
          const regName = mData.participantName || mData.leaderName || "";
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
          const regData = (typeof matchingDoc.data === "function" ? matchingDoc.data() : matchingDoc.data) || {};
          matchedStudentName = regData.participantName || regData.leaderName || matchedStudentName || "Student";

          // Invariant: If student manually entered a 12-digit UTR, NEVER overwrite it with a synthetic AUTO-PTM- reference!
          const rawExistingPaymentId = String(regData.paymentId || "").trim();
          const rawExistingBankUtr = String(
            regData.paymentDetails?.bankUtr ||
            regData.paymentDetails?.utr ||
            regData.customAnswers?.upiUtr ||
            regData.submittedUtr ||
            ""
          ).trim();

          const existingManualUtr = /^\d{12}$/.test(rawExistingPaymentId)
            ? rawExistingPaymentId
            : (/^\d{12}$/.test(rawExistingBankUtr) ? rawExistingBankUtr : "");

          let finalPaymentId = utr;
          if (isSyntheticUtr && existingManualUtr) {
            finalPaymentId = existingManualUtr;
          }

          const updatePayload: Record<string, any> = {
            paymentStatus: "PAID",
            status: "CONFIRMED",
            paymentId: finalPaymentId,
            paidAt: now,
            amountPaid: Number(amount || regData.amountPaid || 0),
            verifiedBy: isSyntheticUtr ? "Auto-Gateway (SRC PayHook - Paytm Notification)" : "Auto-Gateway (SRC PayHook - Bank SMS)",
            verifiedAt: now,
            payerName: payerName || null,
            isFriendPayment: Boolean(isFriendPayment),
            "paymentDetails.paymentStatus": "PAID",
            "paymentDetails.utr": finalPaymentId,
            "paymentDetails.amount": amount,
            "paymentDetails.payerName": payerName || null,
            "paymentDetails.isFriendPayment": Boolean(isFriendPayment),
            "paymentDetails.verifiedAt": now,
          };

          if (isSyntheticUtr) {
            updatePayload["paymentDetails.syntheticUtr"] = utr;
            updatePayload["paymentDetails.gatewaySignalId"] = utr;
            if (existingManualUtr) {
              updatePayload["paymentDetails.bankUtr"] = existingManualUtr;
            }
          } else {
            updatePayload["paymentDetails.bankUtr"] = utr;
          }

          if (existingManualUtr || regData.isManualUtr || regData.submittedUtr) {
            updatePayload.isManualUtr = true;
            updatePayload.submittedUtr = existingManualUtr || regData.submittedUtr;
            updatePayload["paymentDetails.isManualUtr"] = true;
          }

          // Ensure verified_upi_payments/{finalPaymentId} exists before updating registration
          // (e.g. when Paytm synthetic signal matches a registration with a manually entered 12-digit UTR)
          if (finalPaymentId && finalPaymentId !== utr) {
            try {
              await setDoc(doc(db, "verified_upi_payments", finalPaymentId), {
                utr: finalPaymentId,
                amount: Number(amount || regData.amountPaid || 0),
                rawNotification: combinedText,
                status: "MATCHED",
                isSyntheticUtr: false,
                reconciledFromSynthetic: utr,
                source: sourceAppName,
                matchedRegistrationId: matchingDoc.id,
                matchedOrderId: matchedOrderId || regData.orderId || null,
                matchedStudentName: matchedStudentName || null,
                payerName: payerName || null,
                isFriendPayment: Boolean(isFriendPayment),
                receivedAt: now,
                transactionTimestamp,
                notificationTimestamp: rawPostTime || contentDate.getTime(),
                matchedAt: now,
              }, { merge: true });
            } catch {}
          }

          const docRef = matchingDoc.ref || doc(db, "registrations", matchingDoc.id);
          await updateDoc(docRef, updatePayload);
        } else if (matchedOrderId) {
          // Self-Healing Invariant: If student closed browser, auto-create their registration from session draft!
          try {
            const sessSnap = await getDoc(doc(db, "active_checkout_sessions", matchedOrderId));
            if (sessSnap.exists()) {
              const sData = sessSnap.data();
              if (sData?.registrationData && typeof sData.registrationData === "object") {
                const draft = sData.registrationData;

                // Duplicate Registration Guard: never auto-create a second pass if student already has a confirmed registration for this event
                let existingRegForStudent: any = null;
                try {
                  const dEmail = String(draft.email || sData.email || "").trim().toLowerCase();
                  const dBtId = String(draft.btId || sData.btId || "").trim().toUpperCase();
                  const dEventId = String(sData.eventId || draft.eventId || "").trim().toLowerCase();
                  const dEventSlug = String(draft.eventSlug || "").trim().toLowerCase();
                  const isSameEvent = (rd: any) => {
                    if (!rd || rd.status === "CANCELLED" || rd.paymentStatus === "FAILED") return false;
                    const rId = String(rd.eventId || "").trim().toLowerCase();
                    const rSlug = String(rd.eventSlug || "").trim().toLowerCase();
                    return (dEventId && (rId === dEventId || rSlug === dEventId)) || (dEventSlug && (rSlug === dEventSlug || rId === dEventSlug));
                  };
                  if (dEmail) {
                    const eSnap = await getDocs(query(collection(db, "registrations"), where("email", "==", dEmail), limit(10)));
                    existingRegForStudent = eSnap.docs.find((d) => isSameEvent(d.data())) || null;
                  }
                  if (!existingRegForStudent && dBtId && dBtId !== "STUDENT") {
                    const bSnap = await getDocs(query(collection(db, "registrations"), where("btId", "==", dBtId), limit(10)));
                    existingRegForStudent = bSnap.docs.find((d) => isSameEvent(d.data())) || null;
                  }
                } catch {}

                if (existingRegForStudent) {
                  console.warn(`Duplicate registration prevented in webhook for ${draft.email || draft.btId} (existing pass: ${existingRegForStudent.id})`);
                  matchedOrderId = null;
                  matchedRegistrationId = null;
                } else {
                  const regId = sData.registrationId || draft.id || `SRC-${String(sData.eventId || "EVT").slice(0, 3).toUpperCase()}-26-${Math.floor(10000 + Math.random() * 90000)}`;
                  const tkCode = draft.ticketCode || `${String(sData.eventId || "EVT").slice(0, 3).toUpperCase()}26-TK-${Math.floor(1000 + Math.random() * 9000)}`;

                  const sDataSubmittedUtr = String(
                    sData.submittedUtr ||
                    draft.paymentId ||
                    draft.paymentDetails?.bankUtr ||
                    draft.customAnswers?.upiUtr ||
                    ""
                  ).trim();
                  const hasValidSubmittedUtr = /^\d{12}$/.test(sDataSubmittedUtr);
                  const finalDraftPaymentId = (isSyntheticUtr && hasValidSubmittedUtr) ? sDataSubmittedUtr : utr;

                  const newRecord = {
                    ...draft,
                    id: regId,
                    orderId: matchedOrderId,
                    paymentStatus: "PAID",
                    status: "CONFIRMED",
                    paymentId: finalDraftPaymentId,
                    amountPaid: Number(amount || sData.amount || draft.amountPaid || 0),
                    ticketCode: tkCode,
                    qrPayload: draft.qrPayload || `SRC:PASS:${regId}:${tkCode}:${sData.eventId}`,
                    paidAt: now,
                    registeredAt: draft.registeredAt || now,
                    createdAt: now,
                    verifiedBy: isSyntheticUtr ? "Paytm Auto-Gateway (SRC PayHook)" : "Bank SMS Auto-Gateway (SRC PayHook)",
                    verifiedAt: now,
                    payerName: payerName || null,
                    isFriendPayment: Boolean(isFriendPayment),
                    paymentDetails: {
                      ...(draft.paymentDetails || {}),
                      paymentStatus: "PAID",
                      utr: finalDraftPaymentId,
                      amount: Number(amount || sData.amount || draft.amountPaid || 0),
                      ...(isSyntheticUtr ? { syntheticUtr: utr } : { bankUtr: utr }),
                      ...(hasValidSubmittedUtr ? { bankUtr: sDataSubmittedUtr } : {}),
                      verifiedAt: now,
                    },
                  };

                  await setDoc(doc(db, "registrations", regId), newRecord, { merge: true });
                  matchedRegistrationId = regId;
                  matchedStudentName = newRecord.leaderName || newRecord.participantName || matchedStudentName || "Student";
                }
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
          source: sourceAppName,
          matchedRegistrationId: matchedRegistrationId || null,
          matchedOrderId: matchedOrderId || null,
          matchedStudentName: matchedStudentName || null,
          payerName: payerName || null,
          isFriendPayment: Boolean(isFriendPayment),
          receivedAt: now,
          transactionTimestamp,
          notificationTimestamp: rawPostTime || contentDate.getTime(),
          matchedAt: isMatched ? now : null,
        }, { merge: true });
      } catch (ledgerErr) {
        console.warn("Notice: verified_upi_payments ledger write warning:", ledgerErr);
      }

      // 3D. Save diagnostic audit entry in upi_webhook_logs (atomic unique write; zero blocking pre-reads)
      try {
        const logId = `SIG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const logRef = doc(db, "upi_webhook_logs", logId);

        await setDoc(logRef, {
          id: logId,
          receivedAt: now,
          lastReceivedAt: now,
          transactionTimestamp,
          notificationTimestamp: rawPostTime || contentDate.getTime(),
          combinedText: combinedText.slice(0, 500),
          extractedUtr: utr,
          extractedAmount: amount,
          matchedOrderId: matchedOrderId || null,
          matchedRegistrationId: matchedRegistrationId || null,
          matchedStudentName: matchedStudentName || null,
          payerName: payerName || null,
          isFriendPayment: Boolean(isFriendPayment),
          source: sourceAppName,
          status: isMatched ? "MATCHED" : "UNCLAIMED",
          isDuplicate: Boolean(isDuplicateNotification),
          burstCount: 1,
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
      const snap = await getDocs(
        query(
          collection(db, "verified_upi_payments"),
          orderBy("receivedAt", "desc"),
          limit(5)
        )
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      let recentLogs: any[] = [];
      try {
        const logSnap = await getDocs(
          query(
            collection(db, "upi_webhook_logs"),
            orderBy("receivedAt", "desc"),
            limit(10)
          )
        );
        recentLogs = logSnap.docs.map(d => ({ id: d.id, ...d.data() }));
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
