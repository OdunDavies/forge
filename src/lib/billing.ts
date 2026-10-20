import { useEffect, useState } from "react";

export type BillingRegion = "ng" | "intl";
export type BillingInterval = "month" | "year";
export type Membership = "free";
export type PaidMembership = "free";

export function parseMembership(raw: string | null | undefined): Membership {
  return raw && raw.toLowerCase() === "pro" ? "free" : "free";
}

export function membershipLabel(_plan: Membership) {
  return "Free";
}

/** Weekly coach-question cap. null = unlimited. */
export function coachWeekLimit(_plan: Membership): number | null {
  return null;
}

/** Plans to offer only after the current quota is used up. */
export function upgradesWhenExhausted(_plan: Membership): PaidMembership[] {
  return [];
}

export const PLANS = {
  free: {
    id: "free" as const,
    name: "Free",
    blurb: "Log iron. Learn the lifts. One starter week.",
    features: [
      "Prefilled logging from Today",
      "3,700+ movement library",
      "Starter week from onboarding",
      "Unlimited coach questions",
      "Retune session after you finish",
      "Recap cards you can share",
    ],
  },
} as const;

export const PRICES = {
  ng: {
    currency: "NGN",
    symbol: "₦",
    processor: "Paystack",
    processorHint: "Naira cards, bank transfer, USSD",
    place: "Nigeria",
    free: { month: 0, year: 0, yearNote: "Free forever" },
  },
  intl: {
    currency: "USD",
    symbol: "$",
    processor: "Stripe",
    processorHint: "Cards, Apple Pay, Google Pay",
    place: "Rest of world",
    free: { month: 0, year: 0, yearNote: "Free forever" },
  },
} as const;

export function formatPrice(
  region: BillingRegion,
  interval: BillingInterval,
  tier: Membership = "free",
) {
  const p = PRICES[region][tier];
  const amount = interval === "year" ? p.year : p.month;
  if (region === "ng") return `₦${amount.toLocaleString("en-NG")}`;
  return interval === "year" ? `$${amount}` : `$${Number(amount).toFixed(2)}`;
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
