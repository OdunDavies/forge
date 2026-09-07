import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled, signIn, signInWithGoogle } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inSandbox =
    typeof window !== "undefined" && window.location.hostname.endsWith(".grok-sandbox.com");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error") || params.get("error_description");
    if (oauthError) setError(oauthError.replaceAll("_", " "));
  }, []);

  if (!isPending && user) return <Navigate to="/today" />;

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "Athlete",
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message);
      }
      await navigate({ to: "/today" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not authenticate");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle({ callbackURL: "/today", errorCallbackURL: "/login" });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Use email, or add GOOGLE_CLIENT_ID on Vercel.",
      );
      setBusy(false);
    }
  }

  async function onX() {
    setError(null);
    setBusy(true);
    try {
      await signIn("grok-x", { callbackURL: "/today", errorCallbackURL: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "X sign-in failed");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 inline-flex">
          <Wordmark />
        </Link>
        <h1 className="display text-3xl font-semibold">
          {mode === "in" ? "Welcome back" : "Create your log"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Email works here. Google too.
        </p>

        {authEnabled ? (
          <div className="mt-8 space-y-6">
            <form onSubmit={onEmail} className="space-y-4">
              {mode === "up" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              {error && <p className="text-sm text-signal">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </form>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="grid gap-2">
              <Button type="button" variant="outline" onClick={() => void onGoogle()} disabled={busy}>
                Continue with Google
              </Button>
              {inSandbox && (
                <Button type="button" variant="outline" onClick={() => void onX()} disabled={busy}>
                  Continue with X
                </Button>
              )}
            </div>

            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "Need an account? Create one" : "Already lifting here? Sign in"}
            </button>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
