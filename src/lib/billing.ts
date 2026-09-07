import { useEffect, useState } from "react";

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
    place: "Nigeria",
  },
  intl: {
    currency: "USD",
    symbol: "$",
    month: 8.99,
    year: 69,
    yearNote: "Save $38.88",
    processor: "Stripe",
    processorHint: "Cards, Apple Pay, Google Pay",
    place: "Rest of world",
  },
} as const;

export function formatPrice(region: BillingRegion, interval: BillingInterval) {
  const p = PRICES[region];
  const amount = interval === "year" ? p.year : p.month;
  if (region === "ng") return `₦${amount.toLocaleString("en-NG")}`;
  return interval === "year" ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function timezoneLooksNigerian(tz: string) {
  return tz === "Africa/Lagos";
}

function localeLooksNigerian() {
  if (typeof navigator === "undefined") return false;
  const langs = [navigator.language, ...((navigator.languages as string[]) ?? [])]
    .filter(Boolean)
    .map((l) => l.toLowerCase());
  return langs.some((l) => l === "ng" || l.endsWith("-ng") || l.includes("en-ng"));
}

/** Infer billing region from timezone / locale. Does not read localStorage. */
export function detectRegion(): BillingRegion {
  if (typeof window === "undefined") return "intl";
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (timezoneLooksNigerian(tz) || localeLooksNigerian()) return "ng";
  } catch {
    /* ignore */
  }
  return "intl";
}

export function detectedTimezone(): string {
  if (typeof window === "undefined") return "";
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

export function persistRegion(region: BillingRegion) {
  try {
    window.localStorage.setItem("forge-region", region);
  } catch {
    /* ignore */
  }
}

export function useBillingRegion() {
  const [region, setRegionState] = useState<BillingRegion>("intl");
  const [tz, setTz] = useState("");
  const [overridden, setOverridden] = useState(false);

  useEffect(() => {
    let next = detectRegion();
    let wasOverride = false;
    try {
      const saved = window.localStorage.getItem("forge-region");
      if (saved === "ng" || saved === "intl") {
        next = saved;
        wasOverride = saved !== detectRegion();
      }
    } catch {
      /* ignore */
    }
    setRegionState(next);
    setTz(detectedTimezone());
    setOverridden(wasOverride);
  }, []);

  const setRegion = (next: BillingRegion) => {
    setRegionState(next);
    setOverridden(next !== detectRegion());
    persistRegion(next);
  };

  return { region, setRegion, tz, overridden };
}
