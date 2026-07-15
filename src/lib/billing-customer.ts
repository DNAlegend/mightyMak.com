import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Helpers around the billing_customers table (one Stripe customer per user).
// All access is service-role only — never expose these to the browser.

/** The user's Stripe customer + current subscription ids, or null if none yet. */
export async function getBillingCustomer(
  userId: string
): Promise<{ customerId: string; subscriptionId: string | null } | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("billing_customers")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.stripe_customer_id) return null;
  return { customerId: data.stripe_customer_id, subscriptionId: data.stripe_subscription_id ?? null };
}

/** Look up which user a Stripe customer belongs to (webhook path). */
export async function userForCustomer(customerId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data } = await supabaseAdmin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Record the customer id for a user (idempotent upsert). */
export async function saveBillingCustomer(userId: string, customerId: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("billing_customers")
    .upsert({ user_id: userId, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

/** Record the current subscription id for a user (called from the webhook). */
export async function saveSubscriptionId(userId: string, subscriptionId: string | null): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("billing_customers")
    .update({ stripe_subscription_id: subscriptionId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
