import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface GmailConnectionRecord {
  connected: boolean;
  email?: string;
  name?: string;
  avatar?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  connectedAt?: string;
  lastSyncedAt?: string;
  tenureId?: string;
}

/**
 * Retrieves OAuth credentials from environment variables or Firestore settings
 */
export async function getGmailOAuthConfig(): Promise<GmailOAuthConfig | null> {
  const envClientId = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
  const envClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

  if (envClientId && envClientSecret) {
    return { clientId: envClientId.trim(), clientSecret: envClientSecret.trim() };
  }

  if (db && process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    // 1. Try site_content collection first (authoritative and permitted under site_content rules)
    try {
      const snap = await getDoc(doc(db, "site_content", "gmail_oauth_config"));
      if (snap.exists()) {
        const data = snap.data();
        const payload = data?.payload || data;
        if (payload?.clientId && payload?.clientSecret) {
          return { clientId: payload.clientId.trim(), clientSecret: payload.clientSecret.trim() };
        }
      }
    } catch (e) {
      console.warn("Notice: could not read gmail_oauth_config from site_content:", e);
    }

    // 2. Fallback to settings collection
    try {
      const snap = await getDoc(doc(db, "settings", "gmail_oauth_config"));
      if (snap.exists()) {
        const data = snap.data();
        const payload = data?.payload || data;
        if (payload?.clientId && payload?.clientSecret) {
          return { clientId: payload.clientId.trim(), clientSecret: payload.clientSecret.trim() };
        }
      }
    } catch (e) {
      console.warn("Notice: could not read gmail_oauth_config from settings:", e);
    }
  }

  return null;
}

/**
 * Saves OAuth credentials to Firestore
 */
export async function saveGmailOAuthConfig(clientId: string, clientSecret: string): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: false, error: "Database instance is not initialized." };
  }

  const cleanClientId = clientId.trim();
  const cleanClientSecret = clientSecret.trim();
  const timestamp = new Date().toISOString();
  let saved = false;
  let lastError = "";

  // 1. Save to site_content collection (primary storage compliant with Firestore rules)
  try {
    await setDoc(doc(db, "site_content", "gmail_oauth_config"), {
      clientId: cleanClientId,
      clientSecret: cleanClientSecret,
      payload: {
        clientId: cleanClientId,
        clientSecret: cleanClientSecret,
      },
      updatedAt: timestamp
    }, { merge: true });
    saved = true;
  } catch (e: any) {
    console.warn("Warning writing to site_content/gmail_oauth_config:", e);
    lastError = e?.message || "Failed to write to site_content";
  }

  // 2. Also save to settings collection as mirror
  try {
    await setDoc(doc(db, "settings", "gmail_oauth_config"), {
      clientId: cleanClientId,
      clientSecret: cleanClientSecret,
      updatedAt: timestamp
    }, { merge: true });
    saved = true;
  } catch (e: any) {
    console.warn("Notice writing to settings/gmail_oauth_config:", e);
    if (!lastError) lastError = e?.message || "Failed to write to settings";
  }

  if (saved) {
    return { success: true };
  }
  return { success: false, error: lastError || "Failed to write to database. Please check Firestore permissions." };
}

/**
 * Retrieves the currently active Gmail OAuth connection
 */
export async function getStoredGmailConnection(): Promise<GmailConnectionRecord | null> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return null;

  // 1. Try site_content collection
  try {
    const snap = await getDoc(doc(db, "site_content", "gmail_oauth_connection"));
    if (snap.exists()) {
      const data = snap.data();
      return (data?.payload || data) as GmailConnectionRecord;
    }
  } catch (e) {
    console.warn("Notice: could not read gmail_oauth_connection from site_content:", e);
  }

  // 2. Fallback to settings collection
  try {
    const snap = await getDoc(doc(db, "settings", "gmail_oauth_connection"));
    if (snap.exists()) {
      const data = snap.data();
      return (data?.payload || data) as GmailConnectionRecord;
    }
  } catch (e) {
    console.warn("Notice: could not read gmail_oauth_connection from settings:", e);
  }

  return null;
}

/**
 * Saves an active Gmail OAuth connection
 */
export async function saveGmailConnection(connection: GmailConnectionRecord): Promise<boolean> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  const timestamp = new Date().toISOString();
  let saved = false;

  // 1. Write to site_content
  try {
    await setDoc(doc(db, "site_content", "gmail_oauth_connection"), {
      ...connection,
      payload: connection,
      updatedAt: timestamp
    }, { merge: true });
    saved = true;
  } catch (e) {
    console.warn("Notice writing to site_content/gmail_oauth_connection:", e);
  }

  // 2. Write to settings
  try {
    await setDoc(doc(db, "settings", "gmail_oauth_connection"), {
      ...connection,
      updatedAt: timestamp
    }, { merge: true });
    saved = true;
  } catch (e) {
    console.warn("Notice writing to settings/gmail_oauth_connection:", e);
  }

  return saved;
}

/**
 * Clears/disconnects the Gmail OAuth connection
 */
export async function clearGmailConnection(): Promise<boolean> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  const payload = {
    connected: false,
    accessToken: null,
    refreshToken: null,
    disconnectedAt: new Date().toISOString()
  };
  let cleared = false;

  try {
    await setDoc(doc(db, "site_content", "gmail_oauth_connection"), {
      ...payload,
      payload
    }, { merge: true });
    cleared = true;
  } catch (e) {
    console.warn("Notice clearing in site_content:", e);
  }

  try {
    await setDoc(doc(db, "settings", "gmail_oauth_connection"), payload, { merge: true });
    cleared = true;
  } catch (e) {
    console.warn("Notice clearing in settings:", e);
  }

  return cleared;
}

/**
 * Exchanges a refresh token for a fresh Google Access Token
 */
export async function getFreshAccessToken(refreshToken: string, config: GmailOAuthConfig): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!res.ok) {
      console.warn("Google token refresh failed with status:", res.status);
      return null;
    }

    const data = await res.json();
    return data.access_token || null;
  } catch (err) {
    console.error("Google token refresh error:", err);
    return null;
  }
}
