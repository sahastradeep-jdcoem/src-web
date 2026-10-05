import { NextRequest, NextResponse } from "next/server";
import { getRegistrationById } from "@/lib/firebase/firestore";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const cleanId = decodeURIComponent(id || "").trim();

    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: "Missing pass ID" },
        { status: 400 }
      );
    }

    const record = await getRegistrationById(cleanId);
    if (!record) {
      return NextResponse.json(
        { success: false, error: "Delegate pass not found or invalid" },
        { status: 404 }
      );
    }

    // Mask sensitive PII for public gate verification display
    const rawPhone = String(record.phone || "").replace(/\D/g, "");
    const maskedPhone = rawPhone.length >= 4 
      ? `+91 ••••• ••${rawPhone.slice(-4)}` 
      : "Contact on file";

    const rawEmail = String(record.email || "");
    let maskedEmail = "Verified Student";
    if (rawEmail.includes("@")) {
      const [local, domain] = rawEmail.split("@");
      const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}••••` : "••••";
      maskedEmail = `${maskedLocal}@${domain}`;
    }

    const rawPaymentId = String(record.paymentId || "");
    const maskedPaymentId = rawPaymentId && rawPaymentId !== "N/A"
      ? (rawPaymentId.length > 6 ? `••••••••${rawPaymentId.slice(-4)}` : rawPaymentId)
      : null;

    const reg = record as any;
    const sanitizedRecord = {
      id: record.id,
      registrationId: reg.registrationId || record.id,
      ticketCode: record.ticketCode,
      status: record.status,
      paymentStatus: record.paymentStatus,
      amountPaid: record.amountPaid || 0,
      participantName: record.participantName || record.leaderName || "Delegate",
      leaderName: record.leaderName || record.participantName || "Delegate",
      department: record.department,
      year: record.year,
      collegeName: reg.collegeName || "JDCOEM Nagpur",
      college: reg.college,
      city: reg.city,
      btId: record.btId,
      customBranch: reg.customBranch,
      teamType: record.teamType || "Individual",
      teamSize: record.teamSize || 1,
      teamName: record.teamName,
      teamMembers: record.teamMembers,
      eventId: record.eventId,
      eventName: record.eventName || record.eventTitle || "Official Event",
      eventTitle: record.eventTitle || record.eventName || "Official Event",
      eventSlug: record.eventSlug,
      registeredAt: record.registeredAt,
      paidAt: record.paidAt,
      cancellationReason: record.cancellationReason,
      cancelledAt: record.cancelledAt,
      refundStatus: record.refundStatus,
      refundAmount: record.refundAmount,
      refundId: record.refundId,
      qrPayload: record.qrPayload,
      phone: maskedPhone,
      email: maskedEmail,
      paymentId: maskedPaymentId,
    };

    return NextResponse.json({
      success: true,
      record: sanitizedRecord,
    });
  } catch (error: any) {
    console.error("Pass verification API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify delegate pass" },
      { status: 500 }
    );
  }
}
