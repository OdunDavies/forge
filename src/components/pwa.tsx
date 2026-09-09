import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaRoot() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.self !== window.top) return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return <InstallForge />;
}

function InstallForge() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setStandalone(isStandalone);
    if (isStandalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const dismissed = localStorage.getItem("forge-pwa-ios-dismissed") === "1";
    if (ios && !dismissed) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone) return null;

  if (installEvent) {
    return (
      <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg px-3 lg:bottom-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-[var(--shadow-border)] backdrop-blur-md">
          <p className="min-w-0 flex-1 text-sm">Install Forge on your home screen.</p>
          <Button
            size="sm"
            onClick={async () => {
              await installEvent.prompt();
              setInstallEvent(null);
            }}
          >
            <Download className="size-3.5" />
            Install
          </Button>
          <button
            type="button"
            className="grid size-9 place-items-center text-muted-foreground"
            onClick={() => setInstallEvent(null)}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!iosHint) return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-lg px-3 lg:bottom-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-[var(--shadow-border)] backdrop-blur-md">
        <Share className="size-4 shrink-0 text-steel" />
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          On iPhone: Share → Add to Home Screen.
        </p>
        <button
          type="button"
          className="grid size-9 place-items-center text-muted-foreground"
          onClick={() => {
            localStorage.setItem("forge-pwa-ios-dismissed", "1");
            setIosHint(false);
          }}
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
