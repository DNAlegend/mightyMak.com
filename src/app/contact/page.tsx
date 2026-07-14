import type { Metadata } from "next";
import { Mail, Briefcase, CreditCard, Building2 } from "lucide-react";
import { LegalPage, Section, COMPANY } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contact — VIBVID.AI",
  description: "How to reach the team behind VIBVID.AI for support, sales and billing.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      updated="13 July 2026"
      intro={
        <>
          We&rsquo;re a real team and we read every message. Reach us at the addresses below — we aim to
          reply within 2 business days.
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={`mailto:${COMPANY.supportEmail}`}
          className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
            <Mail size={18} />
          </span>
          <div className="mt-3 text-[15px] font-semibold text-fg">Support & billing</div>
          <div className="mt-1 text-sm text-muted">Account help, refunds, and anything about your plan.</div>
          <div className="mt-2 text-sm font-medium text-accent-2">{COMPANY.supportEmail}</div>
        </a>

        <a
          href={`mailto:${COMPANY.salesEmail}`}
          className="rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
            <Briefcase size={18} />
          </span>
          <div className="mt-3 text-[15px] font-semibold text-fg">Sales & business</div>
          <div className="mt-1 text-sm text-muted">High-volume plans, API access, and partnerships.</div>
          <div className="mt-2 text-sm font-medium text-accent-2">{COMPANY.salesEmail}</div>
        </a>
      </div>

      <Section heading="Business details">
        <p className="flex items-start gap-2.5">
          <Building2 size={17} className="mt-0.5 shrink-0 text-faint" />
          <span>
            {COMPANY.brand} is a trading name operating under the brand{" "}
            <strong>{COMPANY.legalName}</strong>. For any query, email{" "}
            <a href={`mailto:${COMPANY.supportEmail}`} className="text-accent-2 underline hover:text-accent">
              {COMPANY.supportEmail}
            </a>
            .
          </span>
        </p>
        <p className="flex items-start gap-2.5">
          <CreditCard size={17} className="mt-0.5 shrink-0 text-faint" />
          <span>
            Card payments and subscriptions are processed securely by our payment processor,{" "}
            <strong>{COMPANY.paymentProcessor}</strong>. For payment or invoice queries, email us or
            use the link on the receipt Mamo emailed you.
          </span>
        </p>
      </Section>
    </LegalPage>
  );
}
