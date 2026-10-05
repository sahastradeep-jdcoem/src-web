import { NextRequest, NextResponse } from "next/server";
import { confirmCashfreeOrderRegistration } from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, orderIds } = body;

    const idsToProcess: string[] = [];
    if (orderId && typeof orderId === "string") {
      idsToProcess.push(orderId.trim());
    }
    if (Array.isArray(orderIds)) {
      orderIds.forEach((id: any) => {
        if (typeof id === "string" && id.trim()) {
          idsToProcess.push(id.trim());
        }
      });
    }

    if (idsToProcess.length === 0) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid Cashfree Order ID." },
        { status: 400 }
      );
    }

    const results: any[] = [];
    for (const id of idsToProcess) {
      try {
        const res = await confirmCashfreeOrderRegistration(id);
        results.push({ orderId: id, ...res });
      } catch (err: any) {
        results.push({ orderId: id, success: false, error: err.message || "Failed to recover order" });
      }
    }

    const allSuccessful = results.every((r) => r.success);
    const anySuccessful = results.some((r) => r.success);

    return NextResponse.json({
      success: anySuccessful,
      allSuccessful,
      count: results.length,
      recoveredCount: results.filter((r) => r.success).length,
      results,
    });
  } catch (error: any) {
    console.error("Cashfree order recovery error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process order recovery" },
      { status: 500 }
    );
  }
}
