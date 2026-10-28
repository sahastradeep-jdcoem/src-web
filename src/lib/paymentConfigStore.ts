import { 
  getSiteContentFromFirestore,
  saveSiteContentToFirestore,
  subscribeToSiteContent
} from "./firebase/firestore";
import { enqueueCloudWrite } from "./dataSyncEngine";

export type PaymentGatewayType = "cashfree" | "instamojo" | "paytm_business";

export interface PublicPaymentConfig {
  gateway: PaymentGatewayType;
  isGatewayActive: boolean;

  // Cashfree PG Settings (Handled securely via Vercel server environment)
  cashfreeAppId?: string;
  cashfreeEnvironment?: "TEST" | "PROD";

  // Instamojo PG Settings
  instamojoApiKey?: string;
  instamojoAuthToken?: string;
  instamojoSalt?: string;
  instamojoEnvironment?: "TEST" | "PROD";

  // Paytm for Business Credentials
  paytmMid?: string;
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

export function sanitizeGateway(gateway: any): PaymentGatewayType {
  if (gateway === "instamojo") return "instamojo";
  if (gateway === "paytm_business") return "paytm_business";
  return "cashfree";
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  gateway: "cashfree",
  isGatewayActive: true,
  cashfreeEnvironment: "PROD",
  instamojoApiKey: "23202cf45d3e1a695e8b003c7b4dada3",
  instamojoAuthToken: "29fc0a17dad486ae928d63b2245d97fb",
  instamojoSalt: "70488dd63d14427998b1cc7a65f371e0",
  instamojoEnvironment: "PROD",
  paytmMid: "YICGYk78325672706387",
  paytmUpiId: "paytm.s3tuv70@pty",
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
          gateway: sanitizeGateway(parsed.gateway),
          isGatewayActive: parsed.isGatewayActive !== undefined ? parsed.isGatewayActive : true,
          instamojoApiKey: parsed.instamojoApiKey || DEFAULT_PAYMENT_CONFIG.instamojoApiKey,
          instamojoAuthToken: parsed.instamojoAuthToken || DEFAULT_PAYMENT_CONFIG.instamojoAuthToken,
          instamojoSalt: parsed.instamojoSalt || DEFAULT_PAYMENT_CONFIG.instamojoSalt,
          instamojoEnvironment: parsed.instamojoEnvironment || "PROD",
          paytmMid: parsed.paytmMid || "YICGYk78325672706387",
          paytmUpiId: parsed.paytmUpiId || "paytm.s3tuv70@pty",
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
      gateway: sanitizeGateway(config.gateway),
      isGatewayActive: config.isGatewayActive !== undefined ? config.isGatewayActive : true,
      cashfreeAppId: config.cashfreeAppId,
      cashfreeEnvironment: config.cashfreeEnvironment || "PROD",
      instamojoApiKey: config.instamojoApiKey || DEFAULT_PAYMENT_CONFIG.instamojoApiKey,
      instamojoAuthToken: config.instamojoAuthToken || DEFAULT_PAYMENT_CONFIG.instamojoAuthToken,
      instamojoSalt: config.instamojoSalt || DEFAULT_PAYMENT_CONFIG.instamojoSalt,
      instamojoEnvironment: config.instamojoEnvironment || "PROD",
      paytmMid: config.paytmMid || "YICGYk78325672706387",
      paytmUpiId: config.paytmUpiId || "paytm.s3tuv70@pty",
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
    gateway: sanitizeGateway(config.gateway ?? current.gateway),
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
        gateway: sanitizeGateway(remote.gateway),
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
          gateway: sanitizeGateway(remoteData.gateway),
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
