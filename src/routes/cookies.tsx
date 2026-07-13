import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

const UPDATED = "July 13, 2026";
const SITE = "https://www.igcloner.com";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — IG-Cloner" },
      { name: "description", content: "How IG-Cloner uses cookies and similar technologies, and how to manage your choices." },
      { property: "og:title", content: "Cookie Policy — IG-Cloner" },
      { property: "og:description", content: "How IG-Cloner uses cookies and similar technologies." },
      { property: "og:url", content: `${SITE}/cookies` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/cookies` }],
  }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
    <LegalLayout title="Cookie Policy" updated={UPDATED}>
      <p>
        This Cookie Policy explains how IG-Cloner uses cookies and similar technologies on{" "}
        <a href={SITE}>www.igcloner.com</a> and the Service.
      </p>

      <h2>1. What Are Cookies?</h2>
      <p>
        Cookies are small text files stored on your device by your browser. Similar technologies
        include local storage, session storage, and pixels. We use them to keep you signed in,
        remember preferences, secure the Service, and understand how it is used.
      </p>

      <h2>2. Categories We Use</h2>
      <ul>
        <li>
          <strong>Strictly necessary.</strong> Required to sign you in, keep the Service secure, and
          load core features. These cannot be turned off.
        </li>
        <li>
          <strong>Preferences.</strong> Remember your settings, such as theme, layout, and last-used
          filters.
        </li>
        <li>
          <strong>Analytics.</strong> Help us understand aggregated usage so we can improve the Service.
          Loaded only with your consent where required.
        </li>
      </ul>
      <p>We do not use advertising or cross-site tracking cookies.</p>

      <h2>3. Managing Your Choices</h2>
      <p>
        Where required by law, we ask for your consent to non-essential cookies via a banner when you
        first visit. You can change your choice any time by clearing your cookie consent from your
        browser storage or by contacting <a href="mailto:privacy@igcloner.com">privacy@igcloner.com</a>.
        You can also block or delete cookies through your browser settings — note this may break parts
        of the Service.
      </p>

      <h2>4. Third Parties</h2>
      <p>
        Some cookies are set by third-party services we use (for example, our authentication and
        payment providers). Their use of information is governed by their own policies.
      </p>

      <h2>5. Changes</h2>
      <p>
        We may update this Cookie Policy. Material changes will be reflected by updating the
        "Last updated" date above.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions? Contact <a href="mailto:privacy@igcloner.com">privacy@igcloner.com</a>.
      </p>
    </LegalLayout>
  );
}