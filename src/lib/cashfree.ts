/**
 * Cashfree Payment Gateway Engine (v2023-08-01 API)
 * Official integration for SRC JDCOEM — Sahastradeep
 */

export interface CashfreeCredentials {
  appId: string;
  secretKey: string;
  environment: "TEST" | "PROD";
}

export interface CreateCashfreeOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerDetails: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  };
  orderMeta?: {
    returnUrl?: string;
    notifyUrl?: string;
    paymentMethods?: string;
  };
  orderNote?: string;
  orderTags?: Record<string, string>;
}

export interface CashfreeOrderResponse {
  cf_order_id: string | number;
  order_id: string;
  entity: string;
  order_currency: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";
  payment_session_id: string;
  order_expiry_time?: string;
  created_at?: string;
  customer_details?: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    payment_methods?: string;
  };
}

export interface CashfreePaymentItem {
  cf_payment_id: string | number;
  order_id: string;
  entity: string;
  payment_currency: string;
  payment_amount: number;
  payment_time: string;
  payment_status: "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED";
  payment_message?: string;
  bank_reference?: string; // UTR or Bank RRN
  auth_id?: string;
  payment_method?: {
    upi?: {
      channel?: string;
      upi_id?: string;
    };
    card?: {
      channel?: string;
      card_number?: string;
      card_network?: string;
      card_type?: string;
    };
    netbanking?: {
      channel?: string;
      netbanking_bank_name?: string;
    };
    app?: {
      channel?: string;
      provider?: string;
    };
  };
  payment_group?: string;
}

export interface CashfreeRefundResponse {
  cf_refund_id: string | number;
  refund_id: string;
  order_id: string;
  entity: string;
  refund_amount: number;
  refund_currency: string;
  refund_status: "SUCCESS" | "PENDING" | "CANCELLED" | "FAILED";
  refund_mode?: string;
  refund_type?: string;
  refund_arn?: string;
  created_at?: string;
  processed_at?: string;
}

/**
 * Resolve server credentials from server environment only.
 * Never read payment credentials from client state or Firestore.
 */
export async function getServerCashfreeCredentials(): Promise<CashfreeCredentials> {
  const appId = process.env.CASHFREE_APP_ID || "";
  const secretKey = process.env.CASHFREE_SECRET_KEY || "";

  const environment =
    (process.env.CASHFREE_ENVIRONMENT as "TEST" | "PROD") || "TEST";

  return { appId: appId.trim(), secretKey: secretKey.trim(), environment };
}

/**
 * Returns Cashfree API base endpoint
 */
export function getCashfreeBaseUrl(environment: "TEST" | "PROD"): string {
  return environment === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

/**
 * Standard Cashfree API Request Headers
 */
export function getCashfreeHeaders(credentials: CashfreeCredentials): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-version": "2023-08-01",
    "x-client-id": credentials.appId,
    "x-client-secret": credentials.secretKey,
  };
}

/**
 * Create an Order on Cashfree and receive payment_session_id
 */
export async function createCashfreeOrder(
  params: CreateCashfreeOrderParams,
  customCredentials?: CashfreeCredentials
): Promise<CashfreeOrderResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error(
      "Cashfree credentials not configured. Please set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Vercel settings or in Admin Console > Registrations > Payment Settings."
    );
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  // Normalize phone number (must be 10 digits for Indian standard)
  let cleanPhone = (params.customerDetails.customerPhone || "").replace(/\D/g, "");
  if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
  if (cleanPhone.length < 10) cleanPhone = "9999999999";

  const payload = {
    order_id: params.orderId,
    order_amount: Number(params.orderAmount.toFixed(2)),
    order_currency: params.orderCurrency || "INR",
    customer_details: {
      customer_id: params.customerDetails.customerId || `cust_${Date.now()}`,
      customer_name: params.customerDetails.customerName || "Student Delegate",
      customer_email: params.customerDetails.customerEmail || "student@jdcoem.ac.in",
      customer_phone: cleanPhone,
    },
    order_meta: {
      return_url: params.orderMeta?.returnUrl || null,
      notify_url: params.orderMeta?.notifyUrl || null,
      payment_methods: params.orderMeta?.paymentMethods || null,
    },
    order_note: params.orderNote || "SRC JDCOEM Event Registration",
    order_tags: params.orderTags || null,
  };

  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: getCashfreeHeaders(creds),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Order Creation Failed (${response.status}): ${errorMsg}`);
  }

  return data as CashfreeOrderResponse;
}

/**
 * Fetch Order details from Cashfree
 */
export async function getCashfreeOrder(
  orderId: string,
  customCredentials?: CashfreeCredentials
): Promise<CashfreeOrderResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const response = await fetch(`${baseUrl}/orders/${orderId}`, {
    method: "GET",
    headers: getCashfreeHeaders(creds),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Order Fetch Failed (${response.status}): ${errorMsg}`);
  }

  return data as CashfreeOrderResponse;
}

/**
 * Fetch all payment attempts/transactions for an order from Cashfree
 */
export async function getCashfreeOrderPayments(
  orderId: string,
  customCredentials?: CashfreeCredentials
): Promise<CashfreePaymentItem[]> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const response = await fetch(`${baseUrl}/orders/${orderId}/payments`, {
    method: "GET",
    headers: getCashfreeHeaders(creds),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Payments Fetch Failed (${response.status}): ${errorMsg}`);
  }

  return (Array.isArray(data) ? data : []) as CashfreePaymentItem[];
}

/**
 * Initiate an automated instant refund for an order via Cashfree
 */
export async function createCashfreeRefund(
  orderId: string,
  refundAmount: number,
  refundId: string,
  refundNote: string = "Refund by SRC JDCOEM Secretariat",
  customCredentials?: CashfreeCredentials
): Promise<CashfreeRefundResponse> {
  const creds = customCredentials || (await getServerCashfreeCredentials());
  if (!creds.appId || !creds.secretKey) {
    throw new Error("Cashfree credentials not configured.");
  }
  const baseUrl = getCashfreeBaseUrl(creds.environment);

  const payload = {
    refund_id: refundId,
    refund_amount: Number(refundAmount.toFixed(2)),
    refund_note: refundNote,
    refund_speed: "STANDARD",
  };

  const response = await fetch(`${baseUrl}/orders/${orderId}/refunds`, {
    method: "POST",
    headers: getCashfreeHeaders(creds),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || data.error || JSON.stringify(data);
    throw new Error(`Cashfree Refund Failed (${response.status}): ${errorMsg}`);
  }

  return data as CashfreeRefundResponse;
}
