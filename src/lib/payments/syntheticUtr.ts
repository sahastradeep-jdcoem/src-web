/**
 * Universal deterministic hash function for generating synthetic UTRs without external Node dependencies
 */
function getDeterministicHashHex(input: string): string {
  try {
    if (typeof window === "undefined") {
      // Dynamic require avoids Webpack bundling node:crypto into browser client packages
      const crypto = eval("require")("crypto");
      if (crypto && typeof crypto.createHash === "function") {
        return crypto.createHash("sha256").update(input).digest("hex").slice(0, 10).toUpperCase();
      }
    }
  } catch {
    // Fallback if require is not available
  }

  // Universal pure-JS 64-bit deterministic hash
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(12, "0").slice(0, 10).toUpperCase();
}

/**
 * Generates a deterministic deduplication UTR for Paytm/UPI notifications that lack an explicit 12-digit UTR.
 * Normalizes amount, sender, and 3-minute transaction time window so duplicate bursts of the exact same payment produce the identical UTR.
 */
export function generateDeterministicSyntheticUtr(
  sender: string,
  amount: number,
  text: string,
  transactionTimeMs?: number
): string {
  const cleanAmount = (amount || 0).toFixed(2);
  const cleanSender = (sender || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 3-minute sliding window based on actual transaction time
  const refTime = transactionTimeMs && transactionTimeMs > 0 ? transactionTimeMs : Date.now();
  const timeBucket = Math.floor(refTime / (3 * 60 * 1000));
  const rawKey = `${cleanAmount}_${cleanSender || "direct"}_${timeBucket}`;
  const hash = getDeterministicHashHex(rawKey);
  return `AUTO-PTM-${hash}`;
}

/**
 * Resolves user-friendly payment app name from Android package name, User-Agent, or content heuristics
 */
export function resolveSourceAppName(
  packageName?: string | null,
  userAgent?: string | null,
  text?: string
): string {
  const pkg = (packageName || "").toLowerCase().trim();
  const ua = (userAgent || "").toLowerCase().trim();
  const t = (text || "").toLowerCase();

  // 1. Direct package name detection
  if (pkg.includes("messaging") || pkg.includes("mms") || pkg.includes("sms") || ua.includes("messaging")) {
    return "Google Messages (SMS)";
  }
  if (pkg.includes("paytm") || ua.includes("paytm")) {
    return "Paytm for Business";
  }
  if (pkg.includes("phonepe") || ua.includes("phonepe")) {
    return "PhonePe";
  }
  if (pkg.includes("paisa") || (pkg.includes("google") && pkg.includes("pay")) || ua.includes("gpay")) {
    return "Google Pay";
  }
  if (pkg.includes("truecaller")) {
    return "Truecaller";
  }
  if (pkg.includes("bhim") || pkg.includes("npci")) {
    return "BHIM UPI";
  }
  if (pkg.includes("diagnostics")) {
    return "PayHook Diagnostics";
  }
  if (ua.includes("macrodroid")) {
    return "MacroDroid";
  }

  // 2. Text heuristics fallback
  if (t.includes("canbnk") || t.includes("canara") || t.includes("hdfc") || t.includes("sbi") || t.includes("icici") || t.includes("axis") || t.includes("acct xxx") || t.includes("dear customer")) {
    return "Google Messages (SMS)";
  }
  if (t.includes("received on") || t.includes("received from") || t.includes("paytm") || t.includes("soundbox") || t.includes("auto-ptm")) {
    return "Paytm for Business";
  }
  if (t.includes("phonepe") || t.includes("@ybl") || t.includes("@ibl")) {
    return "PhonePe";
  }
  if (t.includes("gpay") || t.includes("google pay") || t.includes("@ok")) {
    return "Google Pay";
  }

  if (pkg.length > 0 && pkg !== "in.srcjdcoem.payhook") {
    return pkg;
  }
  return "SRC PayHook";
}
