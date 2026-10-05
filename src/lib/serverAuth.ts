import { NextRequest } from "next/server";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";

const HARDCODED_ADMIN_EMAILS = [
  "shendeha@jdcoem.ac.in",
  "studentrepresentcouncil@jdcoem.ac.in",
  "harshshende0718@gmail.com",
  "harshxfr@gmail.com",
  "admin@jdcoem.ac.in",
  "src.president@jdcoem.ac.in",
  "src.mentor@jdcoem.ac.in",
  "src.gensec@jdcoem.ac.in",
];

export interface VerifiedAdminResult {
  authorized: boolean;
  email?: string;
  uid?: string;
  role?: string;
  error?: string;
}

/**
 * Authoritatively verifies that an incoming API request originates from an
 * authenticated administrator (Owner, Council Admin, or Treasurer).
 */
export async function verifyAdminRequest(req: NextRequest): Promise<VerifiedAdminResult> {
  const authHeader = req.headers.get("authorization") || req.headers.get("x-admin-token") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

  if (!token) {
    return { authorized: false, error: "Authorization required. Missing administrator token." };
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return { authorized: false, error: "Server authentication configuration missing." };
  }

  try {
    // Cryptographically verify ID token against Google Identity Toolkit
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!verifyRes.ok) {
      return { authorized: false, error: "Invalid or expired administrator credentials." };
    }

    const data = await verifyRes.json();
    const user = data.users?.[0];
    if (!user || !user.email) {
      return { authorized: false, error: "Administrator identity could not be resolved." };
    }

    const email = user.email.toLowerCase().trim();
    const uid = user.localId;

    // 1. Break-glass admin emails
    if (HARDCODED_ADMIN_EMAILS.includes(email)) {
      return { authorized: true, email, uid, role: "OWNER" };
    }

    // 2. Check /admins/{email} in Firestore
    if (db) {
      try {
        const adminDoc = await getDoc(doc(db, "admins", email));
        if (adminDoc.exists() && adminDoc.data()?.active !== false) {
          const role = adminDoc.data()?.role || "COUNCIL_ADMIN";
          return { authorized: true, email, uid, role };
        }
      } catch (err) {
        console.warn("Notice: could not query admins collection:", err);
      }

      // 3. Check /admin_access/{uid} or /admin_access/{email}
      try {
        const accessDocUid = await getDoc(doc(db, "admin_access", uid));
        if (accessDocUid.exists() && accessDocUid.data()?.active !== false) {
          const role = accessDocUid.data()?.role || "COUNCIL_ADMIN";
          return { authorized: true, email, uid, role };
        }

        const accessDocEmail = await getDoc(doc(db, "admin_access", email));
        if (accessDocEmail.exists() && accessDocEmail.data()?.active !== false) {
          const role = accessDocEmail.data()?.role || "COUNCIL_ADMIN";
          return { authorized: true, email, uid, role };
        }
      } catch (err) {
        console.warn("Notice: could not query admin_access collection:", err);
      }
    }

    return { authorized: false, error: `Unauthorized: User ${email} does not hold administrator privileges.` };
  } catch (err: any) {
    console.error("Admin verification error:", err);
    return { authorized: false, error: "Failed to authenticate administrator request." };
  }
}
