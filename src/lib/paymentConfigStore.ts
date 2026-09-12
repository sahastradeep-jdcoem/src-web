import { 
  getSiteContentFromFirestore,
  saveSiteContentToFirestore,
  subscribeToSiteContent
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export interface PaymentConfig {
  gateway: "paytm" | "upi";
  paytmMid: string;
  paytmMerchantKey: string;
  paytmWebsite: string;
  paytmEnvironment: "PROD" | "STAGE";
  upiId: string;
  payeeName: string;
  isGatewayActive: boolean;
  instructions?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const PAYMENT_CONFIG_STORAGE_KEY = "src_payment_config";
export const PAYMENT_CONFIG_DOC_ID = "payment_config";
export const PAYMENT_CONFIG_CHANGE_EVENT = "src_payment_config_changed";

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  gateway: "paytm",
  paytmMid: process.env.NEXT_PUBLIC_PAYTM_MID || "",
  paytmMerchantKey: "",
  paytmWebsite: process.env.PAYTM_WEBSITE || "DEFAULT",
  paytmEnvironment: (process.env.PAYTM_ENVIRONMENT as "PROD" | "STAGE") || "PROD",
  upiId: "8237981028@paytm",
  payeeName: "SRC JDCOEM",
  isGatewayActive: true,
  instructions: "Scan QR or tap to open UPI App. Amount is pre-locked for this event.",
  updatedAt: new Date().toISOString(),
  updatedBy: "System",
};

/**
 * Get stored payment config from localStorage with fallback to default
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
        return {
          ...DEFAULT_PAYMENT_CONFIG,
          ...parsed,
          // Always ensure env fallback if not set in storage
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
 * Save payment config to localStorage and trigger local event broadcast
 */
export function saveStoredPaymentConfig(config: PaymentConfig): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(PAYMENT_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(
      new CustomEvent(PAYMENT_CONFIG_CHANGE_EVENT, { detail: config })
    );
  } catch (err) {
    console.error("Error saving payment config to localStorage:", err);
  }
}

/**
 * Save payment config directly to Firestore and local storage (Dual-write invariant)
 */
export async function updatePaymentConfig(
  config: Partial<PaymentConfig>,
  updatedBy: string = "Admin"
): Promise<PaymentConfig> {
  const current = getStoredPaymentConfig();
  const updated: PaymentConfig = {
    ...current,
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

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
      const merged: PaymentConfig = {
        ...DEFAULT_PAYMENT_CONFIG,
        ...remote,
      };
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
        const merged: PaymentConfig = {
          ...DEFAULT_PAYMENT_CONFIG,
          ...remoteData,
        };
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
