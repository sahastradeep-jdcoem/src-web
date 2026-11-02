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
    try {
      const snap = await getDoc(doc(db, "settings", "gmail_oauth_config"));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.clientId && data?.clientSecret) {
          return { clientId: data.clientId.trim(), clientSecret: data.clientSecret.trim() };
        }
      }
    } catch (e) {
      console.warn("Notice: could not read gmail_oauth_config from Firestore:", e);
    }
  }

  return null;
}

/**
 * Saves OAuth credentials to Firestore
 */
export async function saveGmailOAuthConfig(clientId: string, clientSecret: string): Promise<boolean> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  try {
    await setDoc(doc(db, "settings", "gmail_oauth_config"), {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save gmail_oauth_config:", e);
    return false;
  }
}

/**
 * Retrieves the currently active Gmail OAuth connection
 */
export async function getStoredGmailConnection(): Promise<GmailConnectionRecord | null> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return null;
  try {
    const snap = await getDoc(doc(db, "settings", "gmail_oauth_connection"));
    if (snap.exists()) {
      const data = snap.data() as GmailConnectionRecord;
      return data;
    }
  } catch (e) {
    console.warn("Notice: could not read gmail_oauth_connection:", e);
  }
  return null;
}

/**
 * Saves an active Gmail OAuth connection
 */
export async function saveGmailConnection(connection: GmailConnectionRecord): Promise<boolean> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  try {
    await setDoc(doc(db, "settings", "gmail_oauth_connection"), {
      ...connection,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to save gmail_oauth_connection:", e);
    return false;
  }
}

/**
 * Clears/disconnects the Gmail OAuth connection
 */
export async function clearGmailConnection(): Promise<boolean> {
  if (!db || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return false;
  try {
    await setDoc(doc(db, "settings", "gmail_oauth_connection"), {
      connected: false,
      accessToken: null,
      refreshToken: null,
      disconnectedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error("Failed to clear gmail_oauth_connection:", e);
    return false;
  }
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
