import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

const UPDATED = "July 13, 2026";
const SITE = "https://www.igcloner.com";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — IG-Cloner" },
      { name: "description", content: "The terms that govern your use of IG-Cloner, including acceptable use, disclaimers, and limitations of liability." },
      { property: "og:title", content: "Terms of Service — IG-Cloner" },
      { property: "og:description", content: "The terms that govern your use of IG-Cloner." },
      { property: "og:url", content: `${SITE}/terms` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/terms` }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={UPDATED} kind="terms">
      <p>
        These Terms of Service ("Terms") form a binding agreement between you and IG-Cloner
        ("IG-Cloner," "we," "us," or "our"), operator of the website{" "}
        <a href={SITE}>www.igcloner.com</a> and related products and services (the "Service").
        By accessing or using the Service you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. Eligibility & Account</h2>
      <p>
        You must be at least 16 years old and able to form a binding contract to use the Service.
        You are responsible for maintaining the security of your account credentials and for all
        activity under your account. We may suspend or terminate accounts that violate these Terms
        at our sole discretion and without notice.
      </p>

      <h2>2. The Service</h2>
      <p>
        IG-Cloner is an AI-assisted content intelligence platform. It analyzes publicly available
        Instagram content that you submit and helps you generate original derivative content ideas,
        scripts, images, videos, and publishing plans. The Service is provided on an "as-is" and
        "as-available" basis and may change, be paused, or be discontinued at any time.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree that you will not, and will not permit others to:</p>
      <ul>
        <li>Use the Service to violate any law, regulation, or third-party right, including intellectual property, privacy, publicity, or platform terms (including Instagram's, TikTok's, or any other platform's Terms of Service and Community Guidelines);</li>
        <li>Copy, redistribute, or republish another person's protected content without authorization;</li>
        <li>Generate content that is unlawful, defamatory, harassing, hateful, sexual involving minors, deceptive, or that impersonates any person or brand;</li>
        <li>Reverse engineer, scrape, or attempt to derive the source code, models, prompts, or training data of the Service;</li>
        <li>Interfere with, overload, or attempt to gain unauthorized access to the Service, other accounts, or connected systems;</li>
        <li>Resell, sublicense, or provide the Service to third parties except as expressly permitted.</li>
      </ul>
      <p>
        <strong>You are solely responsible for the content you submit, generate, schedule, publish, or distribute
        through the Service, and for ensuring that your use complies with all applicable laws and platform policies.</strong>
      </p>

      <h2>4. Your Content & License to Us</h2>
      <p>
        You retain ownership of the content you upload or provide ("User Content"). You grant IG-Cloner
        a worldwide, non-exclusive, royalty-free license to host, store, transmit, process, display, and
        transform User Content solely to operate, secure, and improve the Service and to provide it to you.
        You represent and warrant that you have all rights necessary to grant this license and that your
        User Content does not infringe any third-party rights.
      </p>

      <h2>5. AI-Generated Output</h2>
      <p>
        The Service uses third-party AI models to generate text, images, audio, and video ("Output").
        Output may be inaccurate, offensive, or unsuitable, and similar or identical Output may be
        produced for other users. You are responsible for reviewing Output before use or publication.
        You use Output at your own risk and are responsible for confirming it does not infringe any
        third-party right, contain confidential information, or violate any law or platform policy.
      </p>

      <h2>6. Third-Party Services</h2>
      <p>
        The Service integrates with third-party platforms and providers (including Instagram, TikTok,
        YouTube, LinkedIn, X, Facebook, Threads, Pinterest, Upload-Post, Apify, Stripe, ElevenLabs,
        Google, and various AI providers). Your use of those services is governed by their own terms
        and privacy policies. IG-Cloner is not responsible for any third-party service, its
        availability, its actions, or its content.
      </p>

      <h2>7. Fees, Trials & Refunds</h2>
      <p>
        Paid plans are billed in advance on a recurring basis until cancelled. Fees are non-refundable
        except where required by law. You may cancel at any time; cancellation takes effect at the end
        of the current billing period. We may change pricing on prospective renewals with reasonable notice.
      </p>

      <h2>8. Intellectual Property</h2>
      <p>
        The Service, including its software, design, text, models, prompts, workflows, and branding,
        is owned by IG-Cloner or its licensors and is protected by intellectual property laws. Except
        for the limited right to use the Service as expressly permitted here, no rights are granted to you.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        THE SERVICE AND ALL OUTPUT ARE PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND,
        WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
        PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED OR ERROR-FREE OPERATION.
        IG-CLONER DOES NOT WARRANT ANY SPECIFIC RESULT, GROWTH, ENGAGEMENT, REVENUE, OR OUTCOME. IG-CLONER
        DOES NOT ENDORSE OR GUARANTEE ANY OUTPUT AND MAKES NO REPRESENTATION THAT USE OF THE SERVICE OR
        OUTPUT COMPLIES WITH ANY THIRD-PARTY PLATFORM'S POLICIES.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL IG-CLONER, ITS AFFILIATES, OFFICERS,
        EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
        EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUES, DATA, GOODWILL, FOLLOWERS,
        REACH, ACCOUNT ACCESS, OR OPPORTUNITY, ARISING OUT OF OR RELATED TO THE SERVICE, EVEN IF ADVISED
        OF THE POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        IG-CLONER'S TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THE SERVICE
        WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO IG-CLONER FOR THE SERVICE IN THE
        THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (B) US $100.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You will defend, indemnify, and hold harmless IG-Cloner and its affiliates from and against
        any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable
        attorneys' fees) arising out of or related to (a) your User Content, (b) your use of Output,
        (c) your use of the Service, (d) your violation of these Terms, or (e) your violation of any
        law or third-party right, including any social media platform's policies.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate your access at any
        time, with or without notice, including for suspected violations of these Terms. Sections that
        by their nature should survive termination will survive, including ownership, disclaimers,
        limitation of liability, indemnification, and dispute resolution.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be indicated by updating
        the "Last updated" date above. Your continued use of the Service after changes take effect
        constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Governing Law & Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict
        of laws principles. Any dispute arising out of or related to these Terms or the Service will be
        resolved exclusively by binding individual arbitration, except that either party may bring a
        claim in small-claims court. YOU AND IG-CLONER WAIVE THE RIGHT TO A JURY TRIAL AND TO
        PARTICIPATE IN A CLASS ACTION.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms? Contact us at <a href="mailto:legal@igcloner.com">legal@igcloner.com</a>.
      </p>
    </LegalLayout>
  );
}