import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Share, PlusSquare, Download, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/get-app")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Get the IG-Cloner app" },
      { name: "description", content: "Add IG-Cloner to your phone home screen or desktop and open it with one tap." },
      { property: "og:title", content: "Get the IG-Cloner app" },
      { property: "og:description", content: "Add IG-Cloner to your phone home screen or desktop and open it with one tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GetAppPage,
});

const KEY = "igc-get-app-dismissed";
type Deferred = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function GetAppPage() {
  const navigate = useNavigate();
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | null>(null);
  const [deferred, setDeferred] = useState<Deferred | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const go = () => { try { if (dontShow || installed) localStorage.setItem(KEY, "1"); } catch {} navigate({ to: "/dashboard", replace: true }); };

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(KEY)) { navigate({ to: "/dashboard", replace: true }); return; }
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    setPlatform(ios ? "ios" : /Android/.test(ua) ? "android" : "desktop");
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as Deferred); };
    const onInstalled = () => { setInstalled(true); try { localStorage.setItem(KEY, "1"); } catch {} };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, [navigate]);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") { setInstalled(true); try { localStorage.setItem(KEY, "1"); } catch {} }
  };

  if (!platform) return null;
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-5 py-10 text-center">
      <img src="/icon-192.png" alt="IG-Cloner app icon" className="h-24 w-24 rounded-[22px] shadow-lg" />
      <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">One more step</p>
      <h1 style={{ fontFamily: "'Archivo Black', sans-serif" }} className="mt-2 text-3xl font-black tracking-tight text-foreground sm:text-4xl">Get the app</h1>
      <p className="mt-3 text-base text-muted-foreground">Put IG-Cloner on your {platform === "desktop" ? "desktop" : "home screen"} and open it with one tap. It's free and takes seconds.</p>

      <div className="mt-8 w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
        {installed ? (
          <p className="flex items-center gap-2 font-semibold text-foreground"><Check className="h-5 w-5 text-primary" /> Installed! Look for the IG-Cloner icon.</p>
        ) : platform === "ios" ? (
          <ol className="space-y-4 text-foreground">
            <li className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Share className="h-4 w-4" /></span><span>In Safari, tap the <b>Share</b> button at the bottom of the screen.</span></li>
            <li className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PlusSquare className="h-4 w-4" /></span><span>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
            <li className="text-sm text-muted-foreground">Using Chrome on iPhone? Open igcloner.com in Safari first.</li>
          </ol>
        ) : deferred ? (
          <Button onClick={install} className="h-12 w-full rounded-full text-base text-primary-foreground" style={{ background: "var(--action-gradient)" }}>
            <Download className="mr-2 h-5 w-5" /> Install IG-Cloner
          </Button>
        ) : (
          <div className="flex gap-3 text-foreground"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Smartphone className="h-4 w-4" /></span>
            <span>{platform === "android" ? <>Tap the <b>⋮ menu</b> in Chrome, then <b>Install app</b> or <b>Add to Home screen</b>.</> : <>Click the <b>install icon</b> at the right of the address bar in Chrome or Edge, or open the browser menu and choose <b>Install IG-Cloner</b>.</>}</span></div>
        )}
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-3 text-base text-foreground">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-5 w-5 accent-primary" />
        Don't show this again
      </label>
      <Button variant="ghost" onClick={go} className="mt-3 rounded-full">{installed ? "Continue to dashboard" : "Skip for now"}</Button>
    </div>
  );
}
