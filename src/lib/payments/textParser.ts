/**
 * Text Parsing & Extraction Utilities for Payment Notifications
 * Handles extraction of 12-digit UTRs, amounts, Indian Standard Time timestamps,
 * and sender names across Paytm, PhonePe, Google Pay, and Bank SMS formats.
 */

/**
 * Extracts 12-digit numeric UPI reference (UTR / RRN / Txn ID) from text
 */
export function extractUtrFromText(text: string): string | null {
  if (!text) return null;

  let decoded = text;
  try {
    if (text.includes("%")) {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    }
  } catch {
    decoded = text;
  }

  // Pattern 1: Explicit labels like "UPI Ref: 425612345678", "UTR: 425612345678", "Ref No: 425612345678", "Txn ID: 425612345678", "rrn: 425612345678"
  const labeledMatch = decoded.match(/(?:upi[\/:\-\s]*(?:cr[\/:\-\s]*)?|utr[\/:\-\s]*|ref(?:\s*no\.?)?[\/:\-\s]*|txn\s*(?:id)?[\/:\-\s]*|rrn[\/:\-\s]*|imps[\/:\-\s]*(?:p2a[\/:\-\s]*)?)(\d{12})/i);
  if (labeledMatch && labeledMatch[1]) {
    return labeledMatch[1];
  }

  // Pattern 2: Key-value / JSON like "utr": "425612345678" or utr=425612345678
  const kvMatch = decoded.match(/(?:utr|reference|ref_no)[\s"':=]+(\d{12})/i);
  if (kvMatch && kvMatch[1]) {
    return kvMatch[1];
  }

  // Pattern 3: Standalone 12-digit number (exclude Indian mobile numbers starting with 91 followed by 6, 7, 8, or 9)
  const standaloneMatches = decoded.matchAll(/\b(\d{12})\b/g);
  for (const m of standaloneMatches) {
    const candidate = m[1];
    if (/^91[6-9]\d{9}$/.test(candidate)) {
      continue;
    }
    return candidate;
  }

  return null;
}

/**
 * Extracts numeric transaction amount from notification text (handles ₹, Rs, INR, decimals, commas)
 */
export function extractAmountFromText(text: string): number | null {
  if (!text) return null;

  let decoded = text;
  try {
    if (text.includes("%")) {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    }
  } catch {
    decoded = text;
  }

  const clean = decoded
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8377;/g, "₹")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Pattern 0: Explicit JSON / URL / Form key e.g. "amount": 1.02 or amount=1.02
  const explicitKeyMatch = clean.match(/(?:amount|amt|total)[\s"':=]+([\d,]+(?:\.\d{1,2})?)/i);
  if (explicitKeyMatch && explicitKeyMatch[1]) {
    const val = parseFloat(explicitKeyMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 1: "Received ₹150.00" or "Received Rs. 150" or "credited with INR 150"
  const receivedMatch = clean.match(/(?:received|credited|payment\s+of|paid|accepted)\s+(?:with\s+|by\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (receivedMatch && receivedMatch[1]) {
    const val = parseFloat(receivedMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 2: "₹150.00" or "Rs 150" or "INR 1.02"
  const currencyMatch = clean.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyMatch && currencyMatch[1]) {
    const val = parseFloat(currencyMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 3: "10 rupees" or "10 rs" or "1.02 received"
  const rupeesMatch = clean.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|rupees|inr|₹|received|credited|paid)/i);
  if (rupeesMatch && rupeesMatch[1]) {
    const val = parseFloat(rupeesMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern 4: "amount of INR 1.02 has been CREDITED"
  const bankAlertMatch = clean.match(/(?:amount\s+of\s+)?(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)\s+(?:has\s+been\s+)?(?:credited|received)/i);
  if (bankAlertMatch && bankAlertMatch[1]) {
    const val = parseFloat(bankAlertMatch[1].replace(/,/g, ""));
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Extracts true transaction date and time from notification text.
 * Parses Indian named months (e.g. "01 Nov 2026, 03:59:41 PM"), numeric dates,
 * and 12-hour/24-hour times, converting with Indian Standard Time (+05:30) offset.
 */
export function extractTimestampFromNotificationContent(text: string, fallbackEpochMs?: number): Date {
  const defaultDate = fallbackEpochMs && fallbackEpochMs > 0 ? new Date(fallbackEpochMs) : new Date();
  if (!text) return defaultDate;

  try {
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    let day = defaultDate.getDate();
    let month = defaultDate.getMonth();
    let year = defaultDate.getFullYear();
    let hours = defaultDate.getHours();
    let minutes = defaultDate.getMinutes();
    let seconds = defaultDate.getSeconds();
    let hasDate = false;
    let hasTime = false;

    // 1. Look for Date with Named Month: e.g. "01 Nov 2026", "1 November 2026", "01-Nov-2026", "01-Nov-26"
    const namedDate = text.match(/\b(\d{1,2})[\s\-]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]+(\d{2,4})\b/i);
    if (namedDate) {
      day = parseInt(namedDate[1], 10);
      const mStr = namedDate[2].slice(0, 3).toLowerCase();
      if (monthMap[mStr] !== undefined) month = monthMap[mStr];
      const y = parseInt(namedDate[3], 10);
      year = y < 100 ? (2000 + y) : y;
      hasDate = true;
    } else {
      // 2. Look for Numeric Date: DD/MM/YY or DD/MM/YYYY or DD-MM-YYYY
      const numDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
      if (numDate) {
        day = parseInt(numDate[1], 10);
        month = parseInt(numDate[2], 10) - 1;
        const y = parseInt(numDate[3], 10);
        year = y < 100 ? (2000 + y) : y;
        hasDate = true;
      }
    }

    // 3. Look for Time: HH:MM:SS AM/PM or HH:MM AM/PM or 24-hr HH:MM:SS
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\b/);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      hours = h;
      hasTime = true;
    }

    if (hasDate || hasTime) {
      // Construct ISO string with Indian Standard Time (+05:30) offset
      const pad = (n: number) => String(n).padStart(2, "0");
      const isoString = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
      const parsed = new Date(isoString);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  } catch {}

  return defaultDate;
}

/**
 * Extracts sender / payer name from incoming notification banner
 */
export function extractSenderName(text: string): string | null {
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
 * Verifies if candidate name shares meaningful name tokens (length >= 3) with sender name
 */
export function isNameCompatible(senderName: string | null, candidateName: string | null): boolean {
  if (!senderName || !candidateName) return true;
  const sParts = senderName.toLowerCase().split(/[\s,.-]+/).filter(p => p.length >= 3);
  const cParts = candidateName.toLowerCase().split(/[\s,.-]+/).filter(p => p.length >= 3);
  if (sParts.length === 0 || cParts.length === 0) return true;
  return sParts.some(sp => cParts.some(cp => cp.includes(sp) || sp.includes(cp)));
}
