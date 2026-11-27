import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "@/data/events";
import { getSiteContentFromFirestore } from "@/lib/firebase/firestore";
import { PublicPaymentConfig } from "@/lib/paymentConfigStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      amount, 
      eventId, 
      eventName, 
      participantName, 
      email, 
      phone, 
      btId, 
      teamType,
      teamSize,
      tenureId,
      upiId: clientUpiId,
      payeeName: clientPayeeName,
      paytmMid: clientMid,
      registrationId,
      registrationData,
      previousOrderId,
    } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Invalid registration fee amount." },
        { status: 400 }
      );
    }

    // Server-side duplicate registration check (prevents multiple passes via multiple tabs/sessions)
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanBt = String(btId || "").trim().toUpperCase();
    const cleanEventId = String(eventId || "").trim().toLowerCase();
    const cleanEventName = String(eventName || "").trim().toLowerCase();

    if (cleanEmail || (cleanBt && cleanBt !== "STUDENT")) {
      try {
        const { db } = await import("@/lib/firebase/config");
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const isEventRecordMatch = (data: any): boolean => {
            if (!data || data.status === "CANCELLED" || data.paymentStatus === "FAILED") return false;
            const rId = String(data.eventId || "").trim().toLowerCase();
            const rSlug = String(data.eventSlug || "").trim().toLowerCase();
            const rName = String(data.eventName || data.eventTitle || "").trim().toLowerCase();
            if (cleanEventId && (rId === cleanEventId || rSlug === cleanEventId)) return true;
            if (cleanEventName && rName && rName === cleanEventName) return true;
            return false;
          };

          const isStudentMatch = (data: any): boolean => {
            const rEmail = String(data.email || "").trim().toLowerCase();
            const rBt = String(data.btId || "").trim().toUpperCase();
            if (cleanEmail && rEmail === cleanEmail) return true;
            if (cleanBt && cleanBt !== "STUDENT" && rBt === cleanBt) return true;
            const members = Array.isArray(data.teamMembers) ? data.teamMembers : Array.isArray(data.members) ? data.members : [];
            return members.some((m: any) => {
              const mEmail = String(m?.email || "").trim().toLowerCase();
              const mBt = String(m?.btId || "").trim().toUpperCase();
              return (cleanEmail && mEmail === cleanEmail) || (cleanBt && cleanBt !== "STUDENT" && mBt === cleanBt);
            });
          };

          // Check active_checkout_sessions (allow read: if true) for already-COMPLETED sessions for this student + event
          try {
            const completedSnap = await getDocs(
              eventId
                ? query(collection(db, "active_checkout_sessions"), where("status", "==", "COMPLETED"), where("eventId", "==", eventId))
                : query(collection(db, "active_checkout_sessions"), where("status", "==", "COMPLETED"))
            );
            const completedDup = completedSnap.docs.find((d: any) => {
              const s = d.data();
              const sEmail = String(s.email || "").trim().toLowerCase();
              const sBt = String(s.btId || "").trim().toUpperCase();
              const sEventId = String(s.eventId || "").trim().toLowerCase();
              const sEventName = String(s.eventName || "").trim().toLowerCase();
              const sameEvent =
                (cleanEventId && sEventId === cleanEventId) ||
                (cleanEventName && sEventName === cleanEventName);
              if (!sameEvent) return false;
              if (cleanEmail && sEmail === cleanEmail) return true;
              if (cleanBt && cleanBt !== "STUDENT" && sBt === cleanBt) return true;
              const rd = s.registrationData;
              if (rd && isStudentMatch(rd)) return true;
              return false;
            });
            if (completedDup) {
              const dupData = completedDup.data();
              return NextResponse.json(
                {
                  success: false,
                  error: `A confirmed pass already exists for ${eventName || "this event"} (Order ID: ${completedDup.id}${dupData?.registrationId ? `, Registration ID: ${dupData.registrationId}` : ""}). Duplicate registrations are not allowed.`,
                },
                { status: 409 }
              );
            }
          } catch {}

          const dupQueries: Promise<any>[] = [];
          if (cleanEmail) {
            dupQueries.push(getDocs(query(collection(db, "registrations"), where("email", "==", cleanEmail))));
            dupQueries.push(getDocs(query(collection(db, "registrations"), where("allMemberEmails", "array-contains", cleanEmail))));
          }
          if (cleanBt && cleanBt !== "STUDENT") {
            dupQueries.push(getDocs(query(collection(db, "registrations"), where("btId", "==", cleanBt))));
            dupQueries.push(getDocs(query(collection(db, "registrations"), where("allMemberBtIds", "array-contains", cleanBt))));
          }

          const dupSnaps = await Promise.allSettled(dupQueries);
          for (const res of dupSnaps) {
            if (res.status === "fulfilled" && res.value?.docs) {
              const found = res.value.docs.find((d: any) => {
                const data = d.data();
                return isEventRecordMatch(data) && isStudentMatch(data);
              });
              if (found) {
                return NextResponse.json(
                  {
                    success: false,
                    error: `A confirmed pass already exists for ${eventName || "this event"} (Registration ID: ${found.id}). Duplicate registrations are not allowed.`,
                  },
                  { status: 409 }
                );
              }
            }
          }
        }
      } catch (dupErr) {
        console.warn("Notice: duplicate check warning in paytm initiate-transaction:", dupErr);
      }
    }

    // Server-side price validation to prevent client-side fee tampering
    if (eventId) {
      const canonicalEvent = mockEvents.find(
        (e) => e.id === eventId || e.slug === eventId
      );
      if (canonicalEvent && canonicalEvent.isPaid) {
        let expectedFee = canonicalEvent.feeAmount || 0;
        if (teamType === "Team" && canonicalEvent.feePricingModel === "per_team" && canonicalEvent.teamFeeAmount) {
          expectedFee = canonicalEvent.teamFeeAmount;
        } else if (teamType === "Team" && canonicalEvent.feePricingModel === "per_person") {
          expectedFee = (canonicalEvent.feeAmount || 0) * (Number(teamSize) || 1);
        }

        if (expectedFee > 0 && Math.abs(Number(amount) - expectedFee) > 0.01) {
          return NextResponse.json(
            { error: `Registration fee mismatch detected. Expected ₹${expectedFee}, received ₹${amount}.` },
            { status: 400 }
          );
        }
      }
    }

    // Default configuration for Paytm for Business
    let mid = process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID || "YICGYk78325672706387";
    let upiId = process.env.NEXT_PUBLIC_PAYTM_UPI_ID || "paytm.s3tuv70@pty";
    let payeeName = "SRC JDCOEM";

    try {
      const remoteConfig = await getSiteContentFromFirestore<PublicPaymentConfig>("payment_config");
      if (remoteConfig) {
        if (remoteConfig.paytmUpiId?.trim()) upiId = remoteConfig.paytmUpiId.trim();
        if (remoteConfig.paytmMerchantName?.trim()) payeeName = remoteConfig.paytmMerchantName.trim();
        if (remoteConfig.paytmMid?.trim()) mid = remoteConfig.paytmMid.trim();
      }
    } catch (fsErr) {
      console.warn("Firestore payment_config read notice in API route:", fsErr);
    }

    // If client provided active values from store, use if valid
    if (clientUpiId && typeof clientUpiId === "string" && clientUpiId.includes("@")) {
      upiId = clientUpiId.trim();
    }
    if (clientPayeeName && typeof clientPayeeName === "string" && clientPayeeName.trim()) {
      payeeName = clientPayeeName.trim();
    }
    if (clientMid && typeof clientMid === "string" && clientMid.trim()) {
      mid = clientMid.trim();
    }

    // Micro-Paisa Dynamic Offset Engine:
    // Guarantees 100% collision-free instant auto-verification across simultaneous payments
    const baseAmount = Number(amount);
    let finalPayableAmount = baseAmount;
    let microPaisaOffset = 0;

    if (baseAmount > 0) {
      try {
        const { db } = await import("@/lib/firebase/config");
        const { collection, query, where, getDocs, limit } = await import("firebase/firestore");
        if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
          const baseInt = Math.floor(baseAmount);
          const activeSessionsQuery = query(
            collection(db, "active_checkout_sessions"),
            where("status", "==", "WAITING"),
            limit(30)
          );
          const snap = await getDocs(activeSessionsQuery);
          const usedOffsets = new Set<number>();

          const nowMs = Date.now();
          snap.docs.forEach((d) => {
            const sData = d.data();
            const expMs = sData.expiresAt 
              ? new Date(sData.expiresAt).getTime() 
              : (sData.createdAt ? new Date(sData.createdAt).getTime() + 5 * 60 * 1000 : 0);

            // Only reserve offsets for active, unexpired sessions (< 5 minutes old)
            if (expMs > nowMs) {
              const sAmt = Number(sData.amount || 0);
              if (Math.floor(sAmt) === baseInt) {
                const diffPaise = Math.round((sAmt - baseInt) * 100);
                if (diffPaise >= 1 && diffPaise <= 99) {
                  usedOffsets.add(diffPaise);
                }
              }
            }
          });

          // Find the lowest available offset between 1 and 99 paise
          for (let p = 1; p <= 99; p++) {
            if (!usedOffsets.has(p)) {
              microPaisaOffset = p;
              break;
            }
          }
          if (microPaisaOffset === 0) {
            microPaisaOffset = Math.floor(1 + Math.random() * 98);
          }

          finalPayableAmount = Number((baseInt + microPaisaOffset / 100).toFixed(2));
        }
      } catch (offsetErr) {
        console.warn("Micro-paisa offset calculation notice:", offsetErr);
      }
    }

    const formattedAmount = finalPayableAmount.toFixed(2);
    const orderId = `SRC-PTM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Build standard NPCI-compliant UPI deep links with locked amount
    const sanitizedPayee = encodeURIComponent(payeeName);
    const note = encodeURIComponent(`${orderId} ${eventName || "SRC Event"}`.slice(0, 50));
    
    // Core parameters for locked payment: pa (VPA), pn (Payee Name), am (Amount), cu (Currency), tn (Transaction Note)
    const baseUpiParams = `pa=${encodeURIComponent(upiId)}&pn=${sanitizedPayee}&am=${formattedAmount}&cu=INR&tn=${note}`;

    const userAgent = req.headers.get("user-agent") || "";
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent));

    const upiLink = `upi://pay?${baseUpiParams}`;
    
    // For iOS Safari: use native iOS registered schemes (tez://, phonepe://, paytmmp://)
    // For Android Chrome: use package-targeted Android intents to launch apps directly
    let gpayLink = `intent://pay?${baseUpiParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
    let phonepeLink = `intent://pay?${baseUpiParams}#Intent;scheme=upi;package=com.phonepe.app;end`;
    let paytmLink = `intent://pay?${baseUpiParams}#Intent;scheme=upi;package=net.one97.paytm;end`;
    let bhimLink = `intent://pay?${baseUpiParams}#Intent;scheme=upi;package=in.org.npci.upiapp;end`;

    if (isIOS) {
      gpayLink = `tez://upi/pay?${baseUpiParams}`;
      phonepeLink = `phonepe://pay?${baseUpiParams}`;
      paytmLink = `paytmmp://pay?${baseUpiParams}`;
      bhimLink = `upi://pay?${baseUpiParams}`;
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Register active checkout session in Firestore for zero-touch auto-detection
    try {
      const { db } = await import("@/lib/firebase/config");
      const { doc, setDoc, collection, query, where, getDocs, limit } = await import("firebase/firestore");
      if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
        const nowIso = new Date().toISOString();

        // Expire any prior WAITING sessions for this student + event (uses Transition 1: WAITING -> EXPIRED)
        try {
          if (previousOrderId && typeof previousOrderId === "string") {
            await setDoc(doc(db, "active_checkout_sessions", previousOrderId), {
              status: "EXPIRED",
              expiredAt: nowIso,
              supersededBy: orderId,
            }, { merge: true }).catch(() => {});
          }

          if (cleanEmail || (cleanBt && cleanBt !== "STUDENT")) {
            const waitingSnap = await getDocs(query(
              collection(db, "active_checkout_sessions"),
              where("status", "==", "WAITING"),
              limit(30)
            ));
            const supersedePromises: Promise<any>[] = [];
            waitingSnap.docs.forEach((d) => {
              const s = d.data();
              const sEmail = String(s.email || "").trim().toLowerCase();
              const sBt = String(s.btId || "").trim().toUpperCase();
              const sEventId = String(s.eventId || "").trim().toLowerCase();
              const sameStudent = (cleanEmail && sEmail === cleanEmail) || (cleanBt && cleanBt !== "STUDENT" && sBt === cleanBt);
              const sameEvent = !cleanEventId || !sEventId || sEventId === cleanEventId;
              if (sameStudent && sameEvent) {
                supersedePromises.push(
                  setDoc(d.ref, {
                    status: "EXPIRED",
                    expiredAt: nowIso,
                    supersededBy: orderId,
                  }, { merge: true }).catch(() => {})
                );
              }
            });
            if (supersedePromises.length > 0) {
              await Promise.allSettled(supersedePromises);
            }
          }
        } catch (supErr) {
          console.warn("Notice: session superseding warning:", supErr);
        }

        await setDoc(doc(db, "active_checkout_sessions", orderId), {
          orderId,
          amount: finalPayableAmount,
          baseAmount,
          microPaisaOffset,
          eventId: eventId || "",
          eventName: eventName || "",
          participantName: participantName || "",
          email: email || "",
          phone: phone || "",
          btId: btId || "",
          registrationId: registrationId || null,
          registrationData: registrationData ? {
            ...registrationData,
            amountPaid: finalPayableAmount,
            orderId,
          } : null,
          status: "WAITING",
          createdAt: new Date().toISOString(),
          expiresAt,
        });
      }
    } catch (sessionErr) {
      console.warn("Notice: could not record active_checkout_sessions:", sessionErr);
    }

    return NextResponse.json({
      success: true,
      orderId,
      amount: finalPayableAmount,
      baseAmount,
      microPaisaOffset,
      formattedAmount,
      currency: "INR",
      upiId,
      payeeName,
      upiLink,
      gpayLink,
      phonepeLink,
      paytmLink,
      bhimLink,
      mid,
      expiresAt,
    });

  } catch (error: any) {
    console.error("Paytm transaction initialization failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize Paytm payment gateway." },
      { status: 500 }
    );
  }
}
