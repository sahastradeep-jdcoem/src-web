import { 
  getSiteContentFromFirestore,
  saveSiteContentToFirestore,
  subscribeToSiteContent
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export interface PublicPaymentConfig {
  gateway: "cashfree" | "paytm" | "upi";
  // Cashfree PG Settings
  cashfreeAppId: string;
  cashfreeEnvironment: "TEST" | "PROD";
  // Paytm PG Settings
  paytmMid: string;
  paytmWebsite: string;
  paytmEnvironment: "PROD" | "STAGE";
  // Direct UPI & General Settings
  upiId: string;
  payeeName: string;
  isGatewayActive: boolean;
  isWebhookActive?: boolean;
  instructions?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Backward-compatible public alias used by existing checkout components.
export type PaymentConfig = PublicPaymentConfig;

export const PAYMENT_CONFIG_STORAGE_KEY = "src_payment_config";
export const PAYMENT_CONFIG_DOC_ID = "payment_config";
export const PAYMENT_CONFIG_CHANGE_EVENT = "src_payment_config_changed";

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  gateway: "cashfree",
  cashfreeAppId: process.env.NEXT_PUBLIC_CASHFREE_APP_ID || "",
  cashfreeEnvironment: (process.env.CASHFREE_ENVIRONMENT as "TEST" | "PROD") || "TEST",
  paytmMid: process.env.NEXT_PUBLIC_PAYTM_MID || "",
  paytmWebsite: process.env.PAYTM_WEBSITE || "DEFAULT",
  paytmEnvironment: (process.env.PAYTM_ENVIRONMENT as "PROD" | "STAGE") || "PROD",
  upiId: "8237981028@paytm",
  payeeName: "SRC JDCOEM",
  isGatewayActive: true,
  isWebhookActive: true,
  instructions: "Instant online checkout powered by Cashfree (UPI, Cards, Netbanking).",
  updatedAt: new Date().toISOString(),
  updatedBy: "System",
};

/**
 * Get public payment config from localStorage with fallback to default.
 * Credentials are intentionally not part of this client-side model.
 */
export function getStoredPaymentConfig(): PaymentConfig {
  if (typeof window === "undefined") {
    return DEFAULT_PAYMENT_CONFIG;
  }

  try {
    const raw = localStorage.getItem(PAYMENT_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const { cashfreeSecretKey: _legacySecret, paytmMerchantKey: _legacyPaytmKey, webhookSecret: _legacyWebhook, ...publicParsed } = parsed as Partial<PaymentConfig> & {
          cashfreeSecretKey?: string;
          paytmMerchantKey?: string;
          webhookSecret?: string;
        };
        // Automatically migrate legacy "paytm" gateway setting to "cashfree"
        const gateway = publicParsed.gateway === "paytm" || !publicParsed.gateway ? "cashfree" : publicParsed.gateway;
        return {
          ...DEFAULT_PAYMENT_CONFIG,
          ...publicParsed,
          gateway,
          // Only the public Cashfree client id may be read in the browser.
          cashfreeAppId: parsed.cashfreeAppId || process.env.NEXT_PUBLIC_CASHFREE_APP_ID || DEFAULT_PAYMENT_CONFIG.cashfreeAppId,
          cashfreeEnvironment: parsed.cashfreeEnvironment || DEFAULT_PAYMENT_CONFIG.cashfreeEnvironment,
          paytmMid: parsed.paytmMid || process.env.NEXT_PUBLIC_PAYTM_MID || "",
        };
      }
    }
  } catch (err) {
    console.warn("Error reading payment config from localStorage:", err);
  }

  return DEFAULT_PAYMENT_CONFIG;
}

/**
 * Save public payment config to localStorage and trigger local event broadcast.
 * Strip legacy secret fields so old browser caches cannot keep propagating them.
 */
export function saveStoredPaymentConfig(config: PaymentConfig): void {
  if (typeof window === "undefined") return;

  try {
    const { cashfreeSecretKey: _legacySecret, paytmMerchantKey: _legacyPaytmKey, webhookSecret: _legacyWebhook, ...publicConfig } = config as PaymentConfig & {
      cashfreeSecretKey?: string;
      paytmMerchantKey?: string;
      webhookSecret?: string;
    };
    localStorage.setItem(PAYMENT_CONFIG_STORAGE_KEY, JSON.stringify(publicConfig));
    window.dispatchEvent(
      new CustomEvent(PAYMENT_CONFIG_CHANGE_EVENT, { detail: config })
    );
  } catch (err) {
    console.error("Error saving payment config to localStorage:", err);
  }
}

/**
 * Save public payment config directly to Firestore and local storage.
 */
export async function updatePaymentConfig(
  config: Partial<PaymentConfig>,
  updatedBy: string = "Admin"
): Promise<PaymentConfig> {
  const current = getStoredPaymentConfig();
  const { cashfreeSecretKey: _legacySecret, paytmMerchantKey: _legacyPaytmKey, webhookSecret: _legacyWebhook, ...publicConfig } = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy,
  } as PaymentConfig & { cashfreeSecretKey?: string; paytmMerchantKey?: string; webhookSecret?: string };
  const updated = publicConfig as PaymentConfig;

  // 1. Instant local persistence and cross-tab event dispatch
  saveStoredPaymentConfig(updated);

  // 2. Instant Firestore dual-write with offline retry queue
  try {
    await saveSiteContentToFirestore(PAYMENT_CONFIG_DOC_ID, updated);
  } catch (err) {
    console.warn("Firestore write failed for payment config, queueing write:", err);
    enqueueCloudWrite(PAYMENT_CONFIG_DOC_ID, updated, "Payment Gateway Settings");
  }

  return updated;
}

/**
 * Sync payment config from Firestore into localStorage
 */
export async function syncPaymentConfigFromFirestore(): Promise<PaymentConfig> {
  try {
    const remote = await getSiteContentFromFirestore<PaymentConfig>(PAYMENT_CONFIG_DOC_ID);
    if (remote && typeof remote === "object") {
      const gateway = remote.gateway === "paytm" || !remote.gateway ? "cashfree" : remote.gateway;
      const merged: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
         ...remote,
         gateway,
       };
      delete (merged as PaymentConfig & { cashfreeSecretKey?: string; webhookSecret?: string }).cashfreeSecretKey;
       delete (merged as PaymentConfig & { paytmMerchantKey?: string }).paytmMerchantKey;
       delete (merged as PaymentConfig & { cashfreeSecretKey?: string; webhookSecret?: string }).webhookSecret;
      saveStoredPaymentConfig(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Failed to sync payment config from Firestore:", err);
  }
  return getStoredPaymentConfig();
}

/**
 * Subscribe to real-time payment config updates from Firestore
 */
export function subscribeToPaymentConfig(
  callback: (config: PaymentConfig) => void
): () => void {
  // 1. Listen for local tab events
  const handleLocalChange = (e: Event) => {
    const customEvent = e as CustomEvent<PaymentConfig>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener(PAYMENT_CONFIG_CHANGE_EVENT, handleLocalChange);
  }

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToSiteContent<PaymentConfig>(
    PAYMENT_CONFIG_DOC_ID,
    (remoteData) => {
      if (remoteData && typeof remoteData === "object") {
        const gateway = remoteData.gateway === "paytm" || !remoteData.gateway ? "cashfree" : remoteData.gateway;
         const merged: PaymentConfig = {
           ...DEFAULT_PAYMENT_CONFIG,
            ...remoteData,
            gateway,
          };
         delete (merged as PaymentConfig & { cashfreeSecretKey?: string; webhookSecret?: string }).cashfreeSecretKey;
          delete (merged as PaymentConfig & { paytmMerchantKey?: string }).paytmMerchantKey;
         delete (merged as PaymentConfig & { cashfreeSecretKey?: string; webhookSecret?: string }).webhookSecret;
        saveStoredPaymentConfig(merged);
        callback(merged);
      }
    }
  );

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener(PAYMENT_CONFIG_CHANGE_EVENT, handleLocalChange);
    }
    unsubscribeFirestore();
  };
}
