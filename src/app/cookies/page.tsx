import type { Metadata } from "next";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy — VIBVID.AI",
  description: "How VIBVID.AI uses cookies and similar local storage technologies.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      updated="13 July 2026"
      intro={
        <>
          This Cookie Policy explains how {COMPANY.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;)
          uses cookies and similar local storage technologies when you use the Service. It should be
          read together with our{" "}
          <a href="/privacy" className="text-accent-2 underline hover:text-accent">Privacy Policy</a>.
        </>
      }
    >
      <Section heading="1. What cookies are">
        <p>
          Cookies are small text files a website stores on your device. &ldquo;Similar
          technologies&rdquo; include your browser&rsquo;s <code>localStorage</code>, which we use to
          keep you signed in and to remember your work between visits. We refer to all of these as
          &ldquo;cookies&rdquo; below.
        </p>
      </Section>

      <Section heading="2. How we use them">
        <p>
          We use only the cookies needed to run the Service. We do <strong>not</strong> use
          advertising cookies, and we do not sell your data or share it with ad networks.
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Essential — authentication.</strong> When you sign in, our authentication
            provider (Supabase) stores a session token so you stay logged in and your library and
            credits load on your account. Without it, you cannot use the Service.
          </li>
          <li>
            <strong>Essential — payments.</strong> During checkout, our payment processor,{" "}
            {COMPANY.paymentProcessor}, sets its own cookies to process the payment securely and
            prevent fraud. These are governed by{" "}
            <a
              href={COMPANY.paymentProcessorSite}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-2 underline hover:text-accent"
            >
              Mamo&rsquo;s privacy &amp; cookie policy
            </a>
            .
          </li>
          <li>
            <strong>Functional — your workspace.</strong> We store your studio state (draft prompts,
            selections and preferences) in your browser&rsquo;s local storage so your work is there
            when you return. This never leaves your device except when you save it to your account.
          </li>
        </ul>
      </Section>

      <Section heading="3. Managing cookies">
        <p>
          Because we use only essential and functional cookies, we do not show a consent banner for
          advertising or tracking. You can clear or block cookies through your browser settings, but
          disabling the essential ones will stop sign-in, checkout, and saving your work from
          functioning.
        </p>
      </Section>

      <Section heading="4. Changes and contact">
        <p>
          We may update this Cookie Policy as the Service evolves; the &ldquo;Last updated&rdquo; date
          above reflects the latest version. Questions? Email{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
