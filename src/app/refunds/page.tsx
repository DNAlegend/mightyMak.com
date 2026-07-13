import type { Metadata } from "next";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — VIBVID.AI",
  description: "How subscriptions, cancellations and refunds work for VIBVID.AI.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      updated="13 July 2026"
      intro={
        <>
          This policy explains how billing, cancellations and refunds work for {COMPANY.brand}. Payments
          are processed by our payment processor, {COMPANY.paymentProcessor}, and refunds are issued by
          us through Mamo back to your original payment method.
        </>
      }
    >
      <Section heading="1. Subscriptions and renewals">
        <p>
          Paid plans are billed in advance on a recurring monthly basis. Each plan grants a set number
          of credits that refresh at the start of every billing cycle and do not roll over. Your
          subscription renews automatically at the then-current price until you cancel.
        </p>
      </Section>

      <Section heading="2. How to cancel">
        <p>
          You can cancel your subscription at any time from your account, or by emailing{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>
          . When you cancel, your plan stays active until the end of the current billing period, and you
          keep access to your remaining credits until then. You will not be charged again after the
          period ends. Cancelling stops future renewals; it does not, by itself, refund the current
          period.
        </p>
      </Section>

      <Section heading="3. Refunds">
        <p>
          Because {COMPANY.brand} delivers digital content that is generated and consumed immediately,
          credits that have already been used are generally non-refundable. That said, we want you to be
          treated fairly:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <strong>14-day goodwill window.</strong> If you are unhappy with a subscription, contact us
            within 14 days of the charge and we will refund it in full provided you have used only a
            minimal amount of the credits included in that period.
          </li>
          <li>
            <strong>Duplicate or accidental charges.</strong> We refund duplicate charges and clear
            billing errors in full.
          </li>
          <li>
            <strong>Service failure.</strong> If a generation fails due to a fault on our side and cannot
            be completed, we will restore the credits it consumed or refund them.
          </li>
          <li>
            <strong>Unused top-up packs.</strong> One-time credit packs are refundable within 14 days of
            purchase if none of the credits have been used.
          </li>
          <li>
            <strong>Policy violations.</strong> If your account is suspended or terminated for a serious
            or repeated breach of our Terms of Service or Acceptable Use Policy, remaining credits are
            forfeited and the goodwill refunds above do not apply. Your statutory rights (section 4)
            are unaffected.
          </li>
        </ul>
        <p>
          Refunds are returned to your original payment method through Mamo, typically within 5–10
          business days depending on your bank. We do not provide cash refunds or credit to other
          accounts.
        </p>
      </Section>

      <Section heading="4. Statutory rights">
        <p>
          Nothing in this policy limits any non-waivable consumer rights you have under the law that
          applies to you. Where you have a statutory right to a refund or a cooling-off period, that
          right applies in addition to this policy.
        </p>
      </Section>

      <Section heading="5. How to request a refund">
        <p>
          Email{" "}
          <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
            {COMPANY.supportEmail}
          </a>{" "}
          from the address on your account, with your order or receipt reference (shown on the receipt
          Mamo emailed you). We aim to respond within 2 business days. We handle all refund requests
          directly.
        </p>
      </Section>
    </LegalPage>
  );
}
