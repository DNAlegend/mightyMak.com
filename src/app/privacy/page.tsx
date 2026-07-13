import type { Metadata } from "next";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — VIBVID.AI",
  description: "How VIBVID.AI collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="13 July 2026"
      intro={
        <>
          This Privacy Policy explains how {COMPANY.legalName} (&ldquo;we&rdquo;, &ldquo;us&rdquo;),
          operator of {COMPANY.brand}, collects, uses and protects your personal data when you use the
          Service. We are the data controller for the personal data described here.
        </>
      }
    >
      <Section heading="1. Data we collect">
        <p>We collect the following categories of data:</p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>Account data</strong> — your email address and authentication details when you sign
            up.
          </li>
          <li>
            <strong>Content data</strong> — the prompts, uploads, characters, and generated images and
            videos you create in the Service.
          </li>
          <li>
            <strong>Transaction data</strong> — records of your purchases, plan, and credit balance. Your
            payment-card details are collected and processed by our payment processor, Mamo, and are
            <em> not</em> stored by us.
          </li>
          <li>
            <strong>Usage and device data</strong> — basic technical information such as IP address,
            browser type, and how you interact with the Service, used to run and secure it.
          </li>
        </ul>
      </Section>

      <Section heading="2. How we use your data">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>To provide, operate and improve the Service and generate the content you request.</li>
          <li>To create and manage your account and credit balance.</li>
          <li>To process payments and provide invoices (through Mamo, our payment processor).</li>
          <li>To communicate with you about your account, security, and service updates.</li>
          <li>To detect, prevent and address fraud, abuse, and violations of our policies.</li>
          <li>To comply with legal obligations.</li>
        </ul>
      </Section>

      <Section heading="3. Legal bases">
        <p>
          Where data-protection law requires a legal basis, we rely on: performance of our contract with
          you (to provide the Service), our legitimate interests (to secure and improve the Service),
          consent (where we ask for it, e.g. optional communications), and compliance with legal
          obligations.
        </p>
      </Section>

      <Section heading="4. Payments">
        <p>
          Payments are handled by {COMPANY.paymentProcessor}, our payment processor; {COMPANY.legalName}{" "}
          is the seller of record. When you check out, you provide your payment details directly to Mamo
          under Mamo&rsquo;s own privacy policy. We receive confirmation of the transaction and limited
          billing information (such as country and the last digits of your card) but never your full
          card number.
        </p>
      </Section>

      <Section heading="5. AI processing and sub-processors">
        <p>
          To generate output, your prompts and reference material are processed by us and by the
          third-party AI model providers and cloud infrastructure we use to run the Service. We share
          only what is needed to fulfil your request. We use reputable providers for hosting, database,
          authentication, AI generation, and payments, and require them to protect your data.
        </p>
      </Section>

      <Section heading="6. Sharing your data">
        <p>
          We do not sell your personal data. We share data only with: the sub-processors described above;
          Mamo for payment processing; and authorities or advisers where required by law or to protect
          our rights. Your generated content is private to your account and is not published by us.
        </p>
      </Section>

      <Section heading="7. Data retention">
        <p>
          We keep your data for as long as your account is active and as needed to provide the Service.
          We retain transaction records for as long as required for tax, accounting and legal purposes.
          When you delete your account, we delete or anonymise your personal data within a reasonable
          period, except where we must keep it to meet legal obligations.
        </p>
      </Section>

      <Section heading="8. Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, delete, or port your
          personal data, to object to or restrict certain processing, and to withdraw consent. To
          exercise any of these rights, email{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>
          . You may also complain to your local data-protection authority.
        </p>
      </Section>

      <Section heading="9. Security">
        <p>
          We use technical and organisational measures — including encryption in transit, access
          controls, and reputable infrastructure providers — to protect your data. No method of
          transmission or storage is completely secure, but we work to protect your information and
          review our safeguards regularly.
        </p>
      </Section>

      <Section heading="10. International transfers">
        <p>
          We and our sub-processors may process data in countries other than yours. Where we transfer
          personal data internationally, we rely on appropriate safeguards, such as standard contractual
          clauses, where required by law.
        </p>
      </Section>

      <Section heading="11. Children">
        <p>
          The Service is not directed to children under 18, and we do not knowingly collect their
          personal data. If you believe a child has provided us data, contact us and we will delete it.
        </p>
      </Section>

      <Section heading="12. Changes and contact">
        <p>
          We may update this Policy from time to time and will change the &ldquo;Last updated&rdquo; date
          above. For any privacy question or request, contact {COMPANY.legalName} at{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>{" "}
          or {COMPANY.address}.
        </p>
      </Section>
    </LegalPage>
  );
}
