import { useEffect, useState } from "react";

export type BillingRegion = "ng" | "intl";
export type BillingInterval = "month" | "year";
export type Membership = "free" | "pro" | "pro_max";
export type PaidMembership = "pro" | "pro_max";

export function parseMembership(raw: string | null | undefined): Membership {
  const v = (raw ?? "free").toLowerCase().replace("-", "_");
  if (v === "pro_max") return "pro_max";
  if (v === "pro") return "pro";
  return "free";
}

export function membershipLabel(plan: Membership) {
  if (plan === "pro_max") return "Pro Max";
  if (plan === "pro") return "Pro";
  return "Free";
}

/** Weekly coach-question cap. null = unlimited. */
export function coachWeekLimit(plan: Membership): number | null {
  if (plan === "pro_max") return null;
  if (plan === "pro") return 40;
  return 5;
}

/** Plans to offer only after the current quota is used up. */
export function upgradesWhenExhausted(plan: Membership): PaidMembership[] {
  if (plan === "free") return ["pro", "pro_max"];
  if (plan === "pro") return ["pro_max"];
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
      "5 coach questions / week",
      "Auto-retune after you finish a session",
      "Recap cards you can share",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "Pro",
    blurb: "The training loop Forge is built around — without paying Max.",
    badge: "Best value",
    features: [
      "Everything in Free",
      "40 coach questions / week — a full training block",
      "Check-in also rewrites today when energy is low",
      "Rebuild the week from your profile any time",
      "Daily session tweaks from fatigue, PRs, injuries",
      "The coach that reads yesterday and writes tomorrow",
    ],
  },
  pro_max: {
    id: "pro_max" as const,
    name: "Pro Max",
    blurb: "Unlimited coach. For people who live in the chat.",
    features: [
      "Everything in Pro",
      "Unlimited Gemini coach",
      "Longer, more detailed rewrites",
      "First in line when the model is busy",
      "No weekly cap — ever",
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
    pro: { month: 4900, year: 39000, yearNote: "Save ₦19,800" },
    pro_max: { month: 9900, year: 79000, yearNote: "Save ₦39,800" },
  },
  intl: {
    currency: "USD",
    symbol: "$",
    processor: "Stripe",
    processorHint: "Cards, Apple Pay, Google Pay",
    place: "Rest of world",
    pro: { month: 8.99, year: 69, yearNote: "Save $38.88" },
    pro_max: { month: 16.99, year: 129, yearNote: "Save $74.88" },
  },
} as const;

export function formatPrice(
  region: BillingRegion,
  interval: BillingInterval,
  tier: PaidMembership = "pro",
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
