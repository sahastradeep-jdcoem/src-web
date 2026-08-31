import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      amount, // In INR (e.g. 150)
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

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid registration fee amount." },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    const receiptId = `SRC-ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Convert amount in INR to Paise (1 INR = 100 Paise)
    const amountInPaise = Math.round(Number(amount) * 100);

    // If Razorpay API keys are configured, generate real Razorpay Order
    if (keyId && keySecret && !keyId.includes("placeholder") && !keySecret.includes("placeholder")) {
      const razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });

      const orderOptions = {
        amount: amountInPaise,
        currency: "INR",
        receipt: receiptId,
        notes: {
          eventId: eventId || "general",
          eventName: eventName || "SRC Event",
          participantName: participantName || "Student",
          btId: btId || "N/A",
          email: email || "N/A",
          phone: phone || "N/A",
          teamType: teamType || "Individual",
          teamSize: String(teamSize || 1),
          tenureId: tenureId || "2025-26",
          college: "JD College of Engineering & Management",
        },
      };

      const order = await razorpay.orders.create(orderOptions);

      return NextResponse.json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        keyId: keyId,
        isMockMode: false,
      });
    }

    // Safe Test / Dev Fallback if API keys are pending
    const mockOrderId = `order_test_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    return NextResponse.json({
      success: true,
      orderId: mockOrderId,
      amount: amountInPaise,
      currency: "INR",
      receipt: receiptId,
      keyId: keyId || "rzp_test_placeholder",
      isMockMode: true,
      notice: "Razorpay running in sandbox test mode. Add live API keys in .env.local to enable real transactions.",
    });

  } catch (error: any) {
    console.error("Razorpay order creation failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initialize payment gateway order." },
      { status: 500 }
    );
  }
}
