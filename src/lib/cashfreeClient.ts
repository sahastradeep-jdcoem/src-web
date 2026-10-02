/**
 * Cashfree Client-Side Checkout Helper (v3 Web SDK)
 * Seamless dropin modal checkout for SRC JDCOEM
 */

declare global {
  interface Window {
    Cashfree?: (config: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_modal" | "_self" | "_blank";
        values?: Record<string, any>;
      }) => Promise<any>;
    };
  }
}

let cashfreeSdkPromise: Promise<any> | null = null;

export function loadCashfreeSDK(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree SDK can only be loaded in the browser."));
  }

  if (window.Cashfree) {
    return Promise.resolve(window.Cashfree);
  }

  if (cashfreeSdkPromise) {
    return cashfreeSdkPromise;
  }

  cashfreeSdkPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("cashfree-js-sdk");
    if (existing) {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        existing.addEventListener("load", () => resolve(window.Cashfree));
        existing.addEventListener("error", (e) => reject(e));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "cashfree-js-sdk";
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        resolve(window.Cashfree);
      } else {
        reject(new Error("Cashfree SDK failed to initialize on window."));
      }
    };
    script.onerror = () => {
      cashfreeSdkPromise = null;
      reject(new Error("Network error loading Cashfree SDK from CDN."));
    };
    document.head.appendChild(script);
  });

  return cashfreeSdkPromise;
}

export interface LaunchCashfreeCheckoutParams {
  paymentSessionId: string;
  environment: "TEST" | "PROD";
}

export async function launchCashfreeCheckout({
  paymentSessionId,
  environment,
}: LaunchCashfreeCheckoutParams): Promise<any> {
  const Cashfree = await loadCashfreeSDK();
  const cashfreeInstance = Cashfree({
    mode: environment === "PROD" ? "production" : "sandbox",
  });

  return cashfreeInstance.checkout({
    paymentSessionId,
    redirectTarget: "_modal",
  });
}
