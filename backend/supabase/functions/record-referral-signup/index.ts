// Supabase Edge Function: record-referral-signup
//
// Why this exists as a server function instead of a direct browser INSERT:
// the whole point of "real" affiliate crediting is that a visitor's browser
// must NOT be able to hand itself money. This function runs with the
// service role key (server-side only, never shipped to the browser), so
// it's the single trusted place that decides "yes, credit $1."
//
// Deploy: supabase functions deploy record-referral-signup
// Call from the frontend with the anon key — this function is what's
// public, not the service role key.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const REFERRAL_BOUNTY_CENTS = 100; // $1.00 — change here if the bounty changes

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain before go-live
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { referralCode, sellerName, sellerEmail } = await req.json();

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // No referral code on this signup — nothing to credit, but that's a
    // normal, expected case (most signups won't come via a referral link).
    if (!referralCode) {
      return json({ credited: false, reason: "no_referral_code" });
    }

    const { data: affiliate, error: findErr } = await supabase
      .from("affiliates")
      .select("id, code")
      .eq("code", referralCode)
      .maybeSingle();

    if (findErr) throw findErr;

    if (!affiliate) {
      // Unknown code — don't error the signup, just don't credit anyone.
      return json({ credited: false, reason: "unknown_code" });
    }

    // Basic abuse guard: block a referral if the same email already exists
    // as a signup event for this affiliate (crude self-referral protection —
    // production should also rate-limit by IP and consider device fingerprinting).
    const { data: existing } = await supabase
      .from("referral_events")
      .select("id")
      .eq("affiliate_id", affiliate.id)
      .eq("type", "signup")
      .eq("metadata->>sellerEmail", sellerEmail ?? "")
      .maybeSingle();

    if (existing) {
      return json({ credited: false, reason: "duplicate_signup" });
    }

    const { error: insertErr } = await supabase.from("referral_events").insert({
      affiliate_id: affiliate.id,
      type: "signup",
      amount_cents: REFERRAL_BOUNTY_CENTS,
      metadata: { sellerName, sellerEmail },
    });

    if (insertErr) throw insertErr;

    return json({ credited: true, amountCents: REFERRAL_BOUNTY_CENTS });
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
