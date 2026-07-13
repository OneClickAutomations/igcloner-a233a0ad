import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "igcloner_cookie_consent_v1";

type Choice = "accepted" | "essential";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  // Invert relative to page: light page => dark banner, dark page => light banner
  const [pageIsDark, setPageIsDark] = useState(false);

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

  useEffect(() => {
    if (!visible) return;
    const read = () => {
      const b = document.body;
      const h = document.documentElement;
      const dark =
        b.getAttribute("data-theme") === "dark" ||
        h.getAttribute("data-theme") === "dark" ||
        h.classList.contains("dark");
      setPageIsDark(dark);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-theme", "class"] });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => obs.disconnect();
  }, [visible]);

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

  // Banner mode is the OPPOSITE of the page theme so it always contrasts.
  const bannerMode = pageIsDark ? "light" : "dark";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className={`cc-root cc-${bannerMode}`}
    >
      <div className="cc-pill">
        <span className="cc-icon" aria-hidden="true">
          <Cookie strokeWidth={2} />
        </span>
        <div className="cc-copy">
          <span className="cc-title">Cookies</span>
          <span className="cc-sub">
            We use cookies to improve your experience.{" "}
            <Link to="/cookies" className="cc-link">
              Learn more
            </Link>
          </span>
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
          bottom: 22px;
          transform: translateX(-50%);
          z-index: 60;
          max-width: calc(100vw - 24px);
          animation: cc-in .45s cubic-bezier(.22,.8,.36,1) both;
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        @keyframes cc-in {
          from { opacity: 0; transform: translate(-50%, 16px) scale(.98); }
          to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .cc-pill {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          padding: 10px 10px 10px 14px;
          border-radius: 9999px;
          backdrop-filter: saturate(180%) blur(20px);
        }
        /* Dark banner — appears on LIGHT pages */
        .cc-dark .cc-pill {
          background: rgba(15, 10, 30, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.06) inset,
            0 12px 40px rgba(15, 10, 30, 0.28),
            0 2px 6px rgba(15, 10, 30, 0.16);
        }
        /* Light banner — appears on DARK pages */
        .cc-light .cc-pill {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(15, 10, 30, 0.06);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.95) inset,
            0 12px 40px rgba(15, 10, 30, 0.14),
            0 2px 6px rgba(15, 10, 30, 0.06);
        }

        .cc-icon {
          flex-shrink: 0;
          width: 34px; height: 34px;
          border-radius: 9999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #F58529, #DD2A7B 45%, #8134AF 80%, #515BD4);
          color: #fff;
          box-shadow: 0 4px 14px rgba(221, 42, 123, 0.35);
        }
        .cc-icon svg { width: 16px; height: 16px; }

        .cc-copy {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          min-width: 0;
          line-height: 1.35;
        }
        .cc-title { font-size: 13px; font-weight: 700; letter-spacing: -0.005em; white-space: nowrap; }
        .cc-sub   { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cc-dark  .cc-title { color: #ffffff; }
        .cc-dark  .cc-sub   { color: rgba(255,255,255,0.7); }
        .cc-light .cc-title { color: #0F0A1E; }
        .cc-light .cc-sub   { color: #4A4060; }

        .cc-link {
          font-weight: 600;
          background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4);
          background-clip: text;
          color: transparent;
          text-decoration: none;
          border-bottom: 1px solid rgba(221, 42, 123, 0.4);
          transition: border-color .15s ease;
        }
        .cc-link:hover { border-bottom-color: #DD2A7B; }

        .cc-actions {
          display: flex;
          align-items: center;
          gap: 4px;
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
          transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease, filter .18s ease;
          white-space: nowrap;
        }
        .cc-btn-ghost { padding: 7px 12px; background: transparent; }
        .cc-dark  .cc-btn-ghost { color: rgba(255,255,255,0.65); }
        .cc-dark  .cc-btn-ghost:hover { color: #fff; background: rgba(255,255,255,0.08); }
        .cc-light .cc-btn-ghost { color: #4A4060; }
        .cc-light .cc-btn-ghost:hover { color: #0F0A1E; background: rgba(15, 10, 30, 0.05); }

        .cc-btn-primary {
          padding: 8px 18px;
          color: #ffffff;
          background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4);
          box-shadow: 0 1px 2px rgba(15,10,30,.10), 0 4px 14px rgba(221,42,123,.30);
        }
        .cc-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(15,10,30,.10), 0 8px 22px rgba(221,42,123,.40);
          filter: saturate(1.05);
        }
        .cc-btn-primary:active { transform: translateY(0); }

        @media (max-width: 620px) {
          .cc-root { width: calc(100vw - 16px); bottom: 12px; }
          .cc-pill {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            padding: 12px;
            border-radius: 20px;
          }
          .cc-copy {
            flex: 1 1 auto;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
          }
          .cc-sub { white-space: normal; }
          .cc-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}