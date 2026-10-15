import { 
  getSiteContentFromFirestore,
  saveSiteContentToFirestore,
  subscribeToSiteContent
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export type PaymentGatewayType = "cashfree" | "paytm_business";

export interface PublicPaymentConfig {
  gateway: PaymentGatewayType;
  isGatewayActive: boolean;

  // Cashfree PG Settings (Handled securely via Vercel server environment)
  cashfreeAppId?: string;
  cashfreeEnvironment?: "TEST" | "PROD";

  // Paytm for Business / Direct Merchant UPI QR Settings
  paytmUpiId?: string;
  paytmMerchantName?: string;
  paytmQrImageUrl?: string;

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
  isGatewayActive: true,
  paytmUpiId: "",
  paytmMerchantName: "SRC JDCOEM",
  paytmQrImageUrl: "",
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
        return {
          ...DEFAULT_PAYMENT_CONFIG,
          ...parsed,
          gateway: (parsed.gateway === "paytm_business" ? "paytm_business" : "cashfree") as PaymentGatewayType,
          isGatewayActive: parsed.isGatewayActive !== undefined ? parsed.isGatewayActive : true,
          paytmUpiId: parsed.paytmUpiId || "",
          paytmMerchantName: parsed.paytmMerchantName || "SRC JDCOEM",
          paytmQrImageUrl: parsed.paytmQrImageUrl || "",
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
 */
export function saveStoredPaymentConfig(config: PaymentConfig): void {
  if (typeof window === "undefined") return;

  try {
    const cleanConfig: PaymentConfig = {
      gateway: (config.gateway === "paytm_business" ? "paytm_business" : "cashfree") as PaymentGatewayType,
      isGatewayActive: config.isGatewayActive !== undefined ? config.isGatewayActive : true,
      paytmUpiId: config.paytmUpiId || "",
      paytmMerchantName: config.paytmMerchantName || "SRC JDCOEM",
      paytmQrImageUrl: config.paytmQrImageUrl || "",
      instructions: config.instructions || DEFAULT_PAYMENT_CONFIG.instructions,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    };
    localStorage.setItem(PAYMENT_CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
    window.dispatchEvent(
      new CustomEvent(PAYMENT_CONFIG_CHANGE_EVENT, { detail: cleanConfig })
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
  const updated: PaymentConfig = {
    ...current,
    ...config,
    gateway: (config.gateway ?? current.gateway ?? "cashfree") as PaymentGatewayType,
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
        gateway: (remote.gateway === "paytm_business" ? "paytm_business" : "cashfree") as PaymentGatewayType,
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
          gateway: (remoteData.gateway === "paytm_business" ? "paytm_business" : "cashfree") as PaymentGatewayType,
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
