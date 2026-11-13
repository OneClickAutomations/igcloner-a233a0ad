import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import landingHtml from "@/assets/landing.html?raw";
import creator0 from "@/assets/creator-portrait-0.jpg.asset.json";
import creator1 from "@/assets/creator-portrait-1.jpg.asset.json";
import creator2 from "@/assets/creator-portrait-2.jpg.asset.json";
import creator3 from "@/assets/creator-portrait-3.jpg.asset.json";
import { supabase } from "@/integrations/supabase/client";

// Inject a click delegator so links inside the srcdoc iframe work:
// - In-page anchors (#id) smooth-scroll within the iframe
// - Absolute paths (/auth, /app, ...) bubble up to the parent via postMessage
const clickScript = `
<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest && e.target.closest('a');
  if (!a) return;
  var href = a.getAttribute('href');
  if (!href || href === '#') { e.preventDefault(); return; }
  if (href.charAt(0) === '#') {
    var el = document.getElementById(href.slice(1));
    if (el) { e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
    return;
  }
  if (href.charAt(0) === '/' || /^https?:/.test(href)) {
    e.preventDefault();
    try { window.parent.postMessage({ __igcloner_nav: href }, '*'); } catch (_) {}
  }
});
</script>
`;

// landing.html may be a fragment without a closing </body>; append the
// delegator in that case so anchor smooth-scroll and link bubbling still work.
const landingWithPortraits = [creator0, creator1, creator2, creator3].reduce(
  (html, portrait, index) => html.replace(`__CREATOR_PORTRAIT_${index}__`, portrait.url),
  landingHtml,
);
const srcDoc = /<\/body>/i.test(landingWithPortraits)
  ? landingWithPortraits.replace(/<\/body>/i, `${clickScript}</body>`)
  : `${landingWithPortraits}\n${clickScript}`;

export function LandingPage() {
  const navigate = useNavigate();
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as
        | { __igcloner_nav?: string; type?: string; url?: string }
        | null;
      if (!data) return;
      if (typeof data.__igcloner_nav === "string") {
        const href = data.__igcloner_nav;
        if (/^https?:/.test(href)) {
          window.location.href = href;
        } else {
          navigate({ to: href });
        }
        return;
      }
      if (data.type === "NAVIGATE_APP") {
        const url = typeof data.url === "string" ? data.url.trim() : "";
        navigate({ to: url.startsWith("/") ? url : "/auth" });
      }
    };

    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <iframe
      ref={ref}
      title="IG-Cloner"
      srcDoc={srcDoc}
      style={{ border: "none", width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
