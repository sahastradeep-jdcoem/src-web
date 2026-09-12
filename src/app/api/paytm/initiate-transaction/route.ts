import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "@/data/events";
import { getStoredPaymentConfig } from "@/lib/paymentConfigStore";

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
      tenureId 
    } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Invalid registration fee amount." },
        { status: 400 }
      );
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

    // Load server environment or stored payment config
    const mid = process.env.PAYTM_MID || process.env.NEXT_PUBLIC_PAYTM_MID || "";
    const merchantKey = process.env.PAYTM_MERCHANT_KEY || "";
    const upiId = process.env.NEXT_PUBLIC_PAYTM_UPI_ID || "8237981028@paytm";
    const payeeName = "SRC JDCOEM";

    const formattedAmount = Number(amount).toFixed(2);
    const orderId = `SRC-PTM-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Build standard NPCI-compliant UPI deep link with locked amount
    const sanitizedPayee = encodeURIComponent(payeeName);
    const note = encodeURIComponent(`${orderId} ${eventName || "SRC Event"}`.slice(0, 50));
    const upiLink = `upi://pay?pa=${upiId}&pn=${sanitizedPayee}&am=${formattedAmount}&cu=INR&tn=${note}&tr=${orderId}`;

    let txnToken = "";
    let isPaytmSdkConfigured = false;

    // If official Paytm Merchant credentials are provided, call Paytm Initiate Transaction API
    if (mid && merchantKey && !mid.includes("placeholder") && !merchantKey.includes("placeholder")) {
      try {
        const paytmPayload = {
          body: {
            requestType: "Payment",
            mid: mid,
            websiteName: process.env.PAYTM_WEBSITE || "DEFAULT",
            orderId: orderId,
            callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://srcjdcoem.in"}/api/paytm/verify-transaction`,
            txnAmount: {
              value: formattedAmount,
              currency: "INR",
            },
            userInfo: {
              custId: btId || phone || `CUST_${Date.now()}`,
              email: email || "",
              mobile: phone || "",
            },
          },
        };

        const host = process.env.PAYTM_ENVIRONMENT === "STAGE" 
          ? "securegw-stage.paytm.in" 
          : "securegw.paytm.in";

        const paytmRes = await fetch(
          `https://${host}/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paytmPayload),
          }
        );

        if (paytmRes.ok) {
          const resData = await paytmRes.json();
          if (resData?.body?.txnToken) {
            txnToken = resData.body.txnToken;
            isPaytmSdkConfigured = true;
          }
        }
      } catch (sdkErr) {
        console.warn("Paytm initiateTransaction API call notice:", sdkErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      amount: Number(amount),
      formattedAmount,
      currency: "INR",
      upiId,
      payeeName,
      upiLink,
      txnToken,
      mid,
      isPaytmSdkConfigured,
    });

  } catch (error: any) {
    console.error("Paytm transaction initialization failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize Paytm payment gateway." },
      { status: 500 }
    );
  }
}
