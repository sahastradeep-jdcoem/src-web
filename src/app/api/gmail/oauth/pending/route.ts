import { NextResponse } from "next/server";

declare global {
  var _latestGmailAuthToken: any;
}

export async function GET() {
  const pending = (global as any)._latestGmailAuthToken || null;
  return NextResponse.json({
    success: true,
    pending: pending
      ? {
          connected: true,
          email: pending.email || null,
          name: pending.name || null,
          avatar: pending.avatar || null,
          accessToken: pending.accessToken || null,
          refreshToken: pending.refreshToken || null,
          expiresAt: pending.expiresAt || null,
          connectedAt: pending.connectedAt || null,
          tenureId: pending.tenureId || "2026-2027"
        }
      : null
  });
}
