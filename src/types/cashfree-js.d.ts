declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";

  export type LoadOptions = {
    mode: CashfreeMode;
  };

  export type CheckoutOptions = {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_modal" | "_blank";
  };

  export type CashfreeInstance = {
    checkout(options: CheckoutOptions): Promise<void>;
  };

  export function load(options: LoadOptions): Promise<CashfreeInstance | null>;
}
