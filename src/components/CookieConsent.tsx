import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "./ui/button";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "igcloner_cookie_consent_v1";

type Choice = "accepted" | "essential";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = (choice: Choice) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-3 bottom-3 z-60 mx-auto max-w-2xl rounded-lg border border-border bg-card p-4 text-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-muted-foreground" aria-hidden="true">
          <Cookie strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Cookies</span>
          <span className="text-sm text-muted-foreground">
            We use cookies to improve your experience.{" "}
            <Link to="/cookies" className="text-primary underline">
              Learn more
            </Link>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => dismiss("essential")}
          >
            Essential only
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => dismiss("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>


    </div>
  );
}