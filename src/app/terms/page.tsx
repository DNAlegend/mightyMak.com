import type { Metadata } from "next";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — VIBVID.AI",
  description: "The terms governing your use of the VIBVID.AI video studio and subscriptions.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="13 July 2026"
      intro={
        <>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {COMPANY.brand}
          {" "}(the &ldquo;Service&rdquo;), operated by {COMPANY.legalName}, a company registered in{" "}
          {COMPANY.jurisdiction} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By creating an
          account, purchasing credits or a subscription, or otherwise using the Service, you agree to
          these Terms. If you do not agree, do not use the Service.
        </>
      }
    >
      <Section heading="1. The Service">
        <p>
          {COMPANY.brand} is an AI video-production studio. It lets you plan a video, create reusable
          characters, generate images and video clips with AI models, and edit them into a finished
          video for download. Features, models and limits may change as we improve the Service.
        </p>
      </Section>

      <Section heading="2. Eligibility and accounts">
        <p>
          You must be at least 18 years old (or the age of majority where you live) and able to form a
          binding contract to use the Service. You are responsible for keeping your account credentials
          secure and for all activity under your account. Provide accurate account information and keep
          it up to date.
        </p>
      </Section>

      <Section heading="3. Credits, plans and billing">
        <p>
          The Service runs on a credit system. Generating content spends credits at the rates shown in
          the app. You obtain credits by subscribing to a monthly plan (credits refresh each billing
          cycle and do not roll over) or by buying one-time top-up packs (which remain valid for 12
          months from purchase). Free-tier credits are provided for evaluation and may carry a
          watermark. Credits are non-transferable service-usage units: they have no cash value and
          cannot be exchanged, transferred, resold, or redeemed for money.
        </p>
        <p>
          <strong>Seller of record &amp; payment processing.</strong> {COMPANY.legalName} is the seller
          of record for all purchases. Card payments and subscriptions are processed securely by our
          payment processor, {COMPANY.paymentProcessor} (&ldquo;Mamo&rdquo;); Mamo handles the checkout
          and card processing but is not a party to your purchase. When you buy from us, your contract
          for both the purchase and the use of the Service is with {COMPANY.legalName} under these Terms.
          Mamo&rsquo;s terms also apply to the payment transaction itself.
        </p>
        <p>
          Subscriptions renew automatically each billing period at the then-current price until you
          cancel. You authorise us and Mamo to charge your payment method on each renewal. Prices are
          shown in US dollars unless stated otherwise, exclusive of any applicable taxes.
        </p>
        <p>
          Cancellation and refunds are governed by our{" "}
          <a href="/refunds" className="text-accent-2 underline hover:text-accent">
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
      </Section>

      <Section heading="4. Your content and licence">
        <p>
          &ldquo;Your Content&rdquo; means the prompts, images, footage, audio, characters and other
          material you upload or provide. You retain ownership of Your Content. You grant us a limited
          licence to host, process and transmit Your Content solely to operate and provide the Service
          to you.
        </p>
        <p>
          You represent that you own or have the rights to Your Content and that it does not infringe
          anyone&rsquo;s rights. In particular, you must have the rights and consents needed to use any
          real person&rsquo;s likeness, voice or brand you provide.
        </p>
      </Section>

      <Section heading="5. Generated output">
        <p>
          Subject to your compliance with these Terms and your payment of applicable fees, you own the
          images and videos you generate with the Service, and — on a paid plan — may use them for
          commercial purposes. AI-generated output may be similar to output produced for other users;
          we do not warrant that output is unique, error-free, or fit for a particular purpose. You are
          responsible for reviewing output before you publish or rely on it. Copyright protection for
          AI-generated material varies by country and may be limited.
        </p>
      </Section>

      <Section heading="6. Acceptable use">
        <p>
          Your use of the Service must comply with our{" "}
          <a href="/acceptable-use" className="text-accent-2 underline hover:text-accent">
            Acceptable Use Policy
          </a>
          , which prohibits, among other things, unlawful content, non-consensual or deceptive
          deepfakes, sexual content involving minors, harassment, and infringement of others&rsquo;
          rights. We may suspend or terminate accounts that violate it.
        </p>
      </Section>

      <Section heading="7. Intellectual property">
        <p>
          The Service, including its software, models, branding and website, is owned by us or our
          licensors and is protected by intellectual-property laws. These Terms grant you no rights in
          our trademarks or technology except the right to use the Service as permitted here.
        </p>
      </Section>

      <Section heading="8. Disclaimers">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
          of any kind, whether express or implied, to the fullest extent permitted by law. We do not
          warrant that the Service will be uninterrupted, secure, or error-free, or that generated
          output will meet your requirements.
        </p>
      </Section>

      <Section heading="9. Limitation of liability">
        <p>
          To the fullest extent permitted by law, we will not be liable for any indirect, incidental,
          special, consequential or punitive damages, or any loss of profits, revenue, data or
          goodwill. Our total liability arising out of or relating to the Service is limited to the
          amount you paid us for the Service in the three months before the event giving rise to the
          claim.
        </p>
      </Section>

      <Section heading="10. Suspension and termination">
        <p>
          You may stop using the Service and cancel your subscription at any time. We may suspend or
          terminate your access if you breach these Terms, fail to pay, or use the Service in a way that
          risks harm to us, other users, or third parties. On termination, your right to use the Service
          ends; sections that by their nature should survive will survive.
        </p>
      </Section>

      <Section heading="11. Changes to these Terms">
        <p>
          We may update these Terms from time to time. If we make material changes, we will update the
          &ldquo;Last updated&rdquo; date and, where appropriate, notify you. Your continued use of the
          Service after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </Section>

      <Section heading="12. Governing law">
        <p>
          These Terms are governed by the laws of {COMPANY.jurisdiction}, without regard to conflict-of-law
          rules. The courts of {COMPANY.jurisdiction} have jurisdiction over any dispute, without
          affecting any mandatory consumer-protection rights you have where you live.
        </p>
      </Section>

      <Section heading="13. Contact">
        <p>
          {COMPANY.legalName} — {COMPANY.address}. Questions about these Terms? Email{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
