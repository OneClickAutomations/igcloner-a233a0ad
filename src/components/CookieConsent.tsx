import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

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
      className="cc-root"
    >
      <div className="cc-pill">
        <div className="cc-copy">
          <span aria-hidden="true" className="cc-dot" />
          <p>
            We use cookies to improve your experience.{" "}
            <Link to="/cookies" className="cc-link">Learn more</Link>
          </p>
        </div>

        <div className="cc-actions">
          <button
            type="button"
            className="cc-btn cc-btn-ghost"
            onClick={() => dismiss("essential")}
          >
            Essential only
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-primary"
            onClick={() => dismiss("accepted")}
          >
            Accept
          </button>
        </div>
      </div>

      <style>{`
        .cc-root {
          position: fixed;
          left: 50%;
          bottom: 20px;
          transform: translateX(-50%);
          z-index: 60;
          max-width: calc(100vw - 24px);
          animation: cc-in .4s cubic-bezier(.22,.8,.36,1) both;
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        @keyframes cc-in {
          from { opacity: 0; transform: translate(-50%, 14px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        .cc-pill {
          display: inline-flex;
          align-items: center;
          gap: 20px;
          padding: 10px 10px 10px 16px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.9);
          border-radius: 9999px;
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.6) inset,
            0 8px 30px rgba(15, 23, 42, 0.06),
            0 2px 6px rgba(15, 23, 42, 0.04);
        }
        .cc-copy {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .cc-copy p {
          margin: 0;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cc-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #3b82f6;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        }
        .cc-link {
          color: #0f172a;
          text-decoration: underline;
          text-decoration-color: rgba(15,23,42,0.2);
          text-underline-offset: 3px;
          font-weight: 600;
          transition: text-decoration-color .15s ease;
        }
        .cc-link:hover { text-decoration-color: rgba(15,23,42,0.6); }
        .cc-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .cc-btn {
          appearance: none;
          border: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 9999px;
          transition: background .15s ease, color .15s ease, transform .15s ease;
          white-space: nowrap;
        }
        .cc-btn-ghost {
          padding: 6px 12px;
          color: #64748b;
          background: transparent;
        }
        .cc-btn-ghost:hover { color: #0f172a; background: rgba(15,23,42,0.04); }
        .cc-btn-primary {
          padding: 8px 16px;
          color: #ffffff;
          background: #0f172a;
          box-shadow: 0 1px 2px rgba(15,23,42,0.15);
        }
        .cc-btn-primary:hover { background: #1e293b; }
        .cc-btn-primary:active { transform: translateY(1px); }

        @media (max-width: 560px) {
          .cc-root { width: calc(100vw - 16px); bottom: 12px; }
          .cc-pill {
            display: flex;
            gap: 10px;
            padding: 10px 10px 10px 14px;
            border-radius: 18px;
          }
          .cc-copy p { white-space: normal; font-size: 12.5px; }
          .cc-actions { margin-left: auto; }
          .cc-btn-ghost { padding: 6px 10px; }
          .cc-btn-primary { padding: 8px 14px; }
        }
      `}</style>
    </div>
  );
}