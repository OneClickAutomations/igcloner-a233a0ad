import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import landingHtml from "@/assets/landing.html?raw";
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

const srcDoc = landingHtml.replace(/<\/body>/i, `${clickScript}</body>`);

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
      const data = ev.data as { __igcloner_nav?: string } | null;
      if (!data || typeof data.__igcloner_nav !== "string") return;
      const href = data.__igcloner_nav;
      if (/^https?:/.test(href)) {
        window.location.href = href;
      } else {
        navigate({ to: href });
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
