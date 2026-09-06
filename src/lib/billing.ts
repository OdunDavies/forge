export type BillingRegion = "ng" | "intl";
export type BillingInterval = "month" | "year";
export type Membership = "free" | "pro";

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    blurb: "Log iron. Learn the lifts. One starter plan.",
    features: [
      "Prefilled logging from Today",
      "3,700+ movement library",
      "One AI plan at onboarding",
      "5 coach questions / week",
      "Recap cards you can share",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    blurb: "The coach that actually reads your log.",
    features: [
      "Unlimited Gemini coach",
      "Daily session tweaks from fatigue, PRs, injuries",
      "Focus-muscle volume bias, rebuilt any time",
      "Priority on the iron feed",
      "Everything in Free",
    ],
  },
} as const;

export const PRICES = {
  ng: {
    currency: "NGN",
    symbol: "₦",
    month: 4900,
    year: 39000,
    yearNote: "Save ₦19,800",
    processor: "Paystack",
    processorHint: "Naira cards, bank transfer, USSD",
  },
  intl: {
    currency: "USD",
    symbol: "$",
    month: 8.99,
    year: 69,
    yearNote: "Save $38.88",
    processor: "Stripe",
    processorHint: "Cards, Apple Pay, Google Pay",
  },
} as const;

export function formatPrice(region: BillingRegion, interval: BillingInterval) {
  const p = PRICES[region];
  const amount = interval === "year" ? p.year : p.month;
  if (region === "ng") return `₦${amount.toLocaleString("en-NG")}`;
  return interval === "year" ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function detectRegion(): BillingRegion {
  if (typeof window === "undefined") return "ng";
  try {
    const saved = window.localStorage.getItem("forge-region");
    if (saved === "ng" || saved === "intl") return saved;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === "Africa/Lagos") return "ng";
    if ((navigator.language || "").toLowerCase().includes("-ng")) return "ng";
  } catch {
    /* ignore */
  }
  return "intl";
}

export function persistRegion(region: BillingRegion) {
  try {
    window.localStorage.setItem("forge-region", region);
  } catch {
    /* ignore */
  }
}
