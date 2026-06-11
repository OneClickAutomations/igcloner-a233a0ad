import landingHtml from "@/assets/landing.html?raw";

// Inject <base target="_top"> so links inside the iframe navigate the parent.
const srcDoc = landingHtml.replace(
  /<head(\s[^>]*)?>/i,
  (m) => `${m}\n<base target="_top">`,
);

export function LandingPage() {
  return (
    <iframe
      title="IGCloner"
      srcDoc={srcDoc}
      style={{ border: "none", width: "100vw", height: "100vh", display: "block" }}
    />
  );
}
