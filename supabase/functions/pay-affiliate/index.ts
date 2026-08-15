// Supabase Edge Function: pay-affiliate
//
// Triggers a REAL Stripe transfer to an affiliate's connected account.
// This is the one function that moves real money — it must only ever be
// callable by an authenticated admin, which is enforced two ways below:
// (1) it requires the caller's Supabase Auth JWT and checks admin_users,
// (2) Stripe Connect itself requires the affiliate to have completed
//     onboarding (KYC) before a transfer will succeed.
//
// Prerequisites before this works:
//   1. A Stripe account with Connect enabled (stripe.com/connect).
//   2. STRIPE_SECRET_KEY set as a Supabase function secret.
//   3. Each affiliate has a stripe_account_id (add this column — see note
//      at the bottom) collected via Stripe Connect onboarding, which you'll
//      need to build as a separate "Connect your bank account" flow on the
//      affiliate dashboard using Stripe's hosted onboarding link. That's a
//      real KYC flow and is intentionally not faked here.
//
// Deploy: supabase functions deploy pay-affiliate

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@16.2.0?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Verify the caller is a logged-in admin (not just "knows a password").
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!adminRow) return json({ error: "not_an_admin" }, 403);

    const { affiliateId } = await req.json();
    const { data: affiliate, error: findErr } = await supabase
      .from("affiliates")
      .select("id, balance_cents, stripe_account_id")
      .eq("id", affiliateId)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!affiliate) return json({ error: "affiliate_not_found" }, 404);
    if (affiliate.balance_cents <= 0) return json({ error: "nothing_owed" }, 400);
    if (!affiliate.stripe_account_id) {
      return json({ error: "affiliate_has_not_completed_stripe_onboarding" }, 400);
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    const transfer = await stripe.transfers.create({
      amount: affiliate.balance_cents,
      currency: "usd",
      destination: affiliate.stripe_account_id,
      description: `Sphere Marketplace affiliate payout — ${affiliate.id}`,
    });

    const { data: payout, error: payoutErr } = await supabase
      .from("payouts")
      .insert({
        affiliate_id: affiliate.id,
        amount_cents: affiliate.balance_cents,
        status: "paid",
        stripe_transfer_id: transfer.id,
      })
      .select()
      .single();
    if (payoutErr) throw payoutErr;

    return json({ paid: true, payout });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Note: run this once in the SQL editor before using this function:
//   alter table affiliates add column if not exists stripe_account_id text;
