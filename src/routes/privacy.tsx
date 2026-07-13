import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

const UPDATED = "July 13, 2026";
const SITE = "https://www.igcloner.com";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — IG-Cloner" },
      { name: "description", content: "How IG-Cloner collects, uses, shares, and protects your information." },
      { property: "og:title", content: "Privacy Policy — IG-Cloner" },
      { property: "og:description", content: "How IG-Cloner collects, uses, shares, and protects your information." },
      { property: "og:url", content: `${SITE}/privacy` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/privacy` }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how IG-Cloner ("we," "us," or "our") collects, uses, shares,
        and protects information when you use <a href={SITE}>www.igcloner.com</a> and related services
        (the "Service"). By using the Service you agree to this Policy.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>Information you provide</h3>
      <ul>
        <li><strong>Account data:</strong> name, email address, password (hashed), and profile settings.</li>
        <li><strong>Content you submit:</strong> Instagram URLs, uploaded images, prompts, briefs, scripts, and other User Content.</li>
        <li><strong>Payment data:</strong> handled by our payment processor (e.g., Stripe). We store limited billing metadata; we do not store full card numbers.</li>
        <li><strong>Connected-account data:</strong> API keys and OAuth tokens for third-party services you choose to connect (encrypted at rest).</li>
        <li><strong>Support communications</strong> you send us.</li>
      </ul>
      <h3>Information collected automatically</h3>
      <ul>
        <li>Log and device data (IP address, browser type, OS, referring URL, timestamps).</li>
        <li>Usage data (features used, actions taken, errors).</li>
        <li>Cookies and similar technologies (see Section 6 and our <a href="/cookies">Cookie Policy</a>).</li>
      </ul>
      <h3>Information from third parties</h3>
      <p>
        When you connect a third-party service, we receive information from that service as you
        authorize (for example, publicly available Instagram profile and post data via Apify, or
        publishing status from Upload-Post). We only request the minimum scopes needed to operate
        the feature.
      </p>

      <h2>2. How We Use Information</h2>
      <ul>
        <li>Provide, secure, and maintain the Service.</li>
        <li>Process AI generations, scheduling, and publishing you request.</li>
        <li>Bill you, prevent fraud, and enforce our Terms.</li>
        <li>Communicate about your account, updates, and support.</li>
        <li>Improve product performance, reliability, and features (using aggregated or de-identified data).</li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p>
        <strong>AI models.</strong> Content you submit is sent to third-party AI providers strictly to
        return an output to you. We do not use your User Content or Output to train our own foundation
        models, and we contractually restrict providers from training on your data where such controls
        are available.
      </p>

      <h2>3. How We Share Information</h2>
      <p>We do not sell your personal information. We share information only as follows:</p>
      <ul>
        <li><strong>Service providers</strong> that host, secure, or operate parts of the Service (e.g., cloud hosting, database, email, analytics, payments, AI model providers, scraping providers, publishing providers).</li>
        <li><strong>At your direction</strong> — for example, when you publish content to a connected social account.</li>
        <li><strong>Legal & safety</strong> — to comply with law, valid legal process, or to protect the rights, property, or safety of IG-Cloner, users, or the public.</li>
        <li><strong>Business transfers</strong> — in a merger, acquisition, financing, or sale of assets, subject to standard confidentiality protections.</li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We retain personal information for as long as your account is active and for a reasonable period
        thereafter to comply with legal obligations, resolve disputes, and enforce agreements. You can
        delete your account and content at any time; some data may persist in backups for a limited period.
      </p>

      <h2>5. Security</h2>
      <p>
        We use industry-standard administrative, technical, and physical safeguards, including
        encryption in transit (TLS) and encryption at rest for connected-service API keys. No system
        is 100% secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use cookies and similar technologies for authentication, security, preferences, and (with
        your consent where required) analytics. See our <a href="/cookies">Cookie Policy</a> for details
        and manage your choices via the cookie banner or your browser settings.
      </p>

      <h2>7. Your Rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, port, or object
        to processing of your personal information, and to withdraw consent. To exercise these rights,
        email <a href="mailto:privacy@igcloner.com">privacy@igcloner.com</a>. We will respond within
        the time required by law. You may also lodge a complaint with your local data protection authority.
      </p>
      <p>
        <strong>California residents (CCPA/CPRA):</strong> we do not "sell" or "share" personal information
        for cross-context behavioral advertising as those terms are defined by California law.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        We operate globally and may transfer information to, and store it in, countries other than your
        own, including the United States. Where required, we use appropriate safeguards such as Standard
        Contractual Clauses.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not directed to children under 16, and we do not knowingly collect personal
        information from children under 16. If you believe a child has provided us information, please
        contact us and we will delete it.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this Policy from time to time. Material changes will be indicated by updating
        the "Last updated" date above and, where required, by additional notice.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about this Policy? Contact us at <a href="mailto:privacy@igcloner.com">privacy@igcloner.com</a>.
      </p>
    </LegalLayout>
  );
}