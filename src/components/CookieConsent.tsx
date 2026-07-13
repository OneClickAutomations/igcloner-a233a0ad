import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

const STORAGE_KEY = "igcloner_cookie_consent_v1";

type Choice = "accepted" | "essential";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Delay slightly so it doesn't fight the first paint
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore storage errors */
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
      className="cookie-consent"
    >
      <div className="cookie-consent__inner">
        <div className="cookie-consent__text">
          <span aria-hidden="true" className="cookie-consent__dot" />
          <p>
            We use cookies for sign-in, security, and — with your consent — analytics.{" "}
            <Link to="/cookies" className="cookie-consent__link">
              Learn more
            </Link>
            .
          </p>
        </div>
        <div className="cookie-consent__actions">
          <button
            type="button"
            className="cookie-consent__btn cookie-consent__btn--ghost"
            onClick={() => dismiss("essential")}
          >
            Essential only
          </button>
          <button
            type="button"
            className="cookie-consent__btn cookie-consent__btn--primary"
            onClick={() => dismiss("accepted")}
          >
            Accept
          </button>
        </div>
      </div>

      <style>{`
        .cookie-consent {
          position: fixed;
          left: 50%;
          bottom: 16px;
          transform: translateX(-50%);
          z-index: 60;
          width: min(560px, calc(100vw - 24px));
          animation: cc-in .35s ease-out both;
        }
        @keyframes cc-in {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .cookie-consent__inner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(17, 18, 20, 0.92);
          color: #f5f5f7;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          backdrop-filter: saturate(160%) blur(14px);
          -webkit-backdrop-filter: saturate(160%) blur(14px);
          box-shadow: 0 10px 30px -12px rgba(0,0,0,.5);
          font-size: 13px;
          line-height: 1.4;
        }
        .cookie-consent__text {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .cookie-consent__text p { margin: 0; }
        .cookie-consent__dot {
          width: 8px; height: 8px; border-radius: 999px;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(168,85,247,.15);
        }
        .cookie-consent__link {
          color: #f5f5f7;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .cookie-consent__actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .cookie-consent__btn {
          appearance: none;
          border: 0;
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 9px;
          cursor: pointer;
          transition: background .15s ease, transform .15s ease;
        }
        .cookie-consent__btn--ghost {
          background: transparent;
          color: #cfcfd4;
        }
        .cookie-consent__btn--ghost:hover { background: rgba(255,255,255,.06); color:#fff; }
        .cookie-consent__btn--primary {
          background: #f5f5f7;
          color: #111214;
        }
        .cookie-consent__btn--primary:hover { background: #fff; transform: translateY(-1px); }
        @media (max-width: 480px) {
          .cookie-consent { width: calc(100vw - 16px); bottom: 10px; }
          .cookie-consent__inner { flex-direction: column; align-items: stretch; padding: 12px; }
          .cookie-consent__actions { justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}