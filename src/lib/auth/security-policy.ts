export function authSecurityPolicy(env: Record<string, string | undefined>) {
  const production = env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const secret = env.BETTER_AUTH_SECRET?.trim();
  const url = env.BETTER_AUTH_URL?.trim();
  if (production && (!secret || secret.length < 32)) {
    throw new Error("Production requires an explicit BETTER_AUTH_SECRET of at least 32 characters");
  }
  if (production && !url) throw new Error("Production requires BETTER_AUTH_URL");
  const origin = url ? new URL(url).origin : undefined;
  if (production && (!origin?.startsWith("https://") || origin.includes("*"))) {
    throw new Error("Production requires an exact HTTPS auth origin");
  }
  return { production, secret, origin };
}

export function devUpgradeAllowed(env: Record<string, string | undefined>): boolean {
  return (
    env.NODE_ENV === "development" &&
    env.VERCEL_ENV !== "production" &&
    !env.STRIPE_SECRET_KEY?.trim() &&
    !env.PAYSTACK_SECRET_KEY?.trim()
  );
}
