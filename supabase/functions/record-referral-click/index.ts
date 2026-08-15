// Supabase Edge Function: record-referral-click
// Called once per session when a visitor lands with ?ref=CODE.
// Deploy: supabase functions deploy record-referral-click

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain before go-live
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const { referralCode } = await req.json();
    if (!referralCode) return json({ recorded: false, reason: "no_code" });

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: affiliate } = await supabase
      .from("affiliates")
      .select("id")
      .eq("code", referralCode)
      .maybeSingle();

    if (!affiliate) return json({ recorded: false, reason: "unknown_code" });

    const { error } = await supabase.from("referral_events").insert({
      affiliate_id: affiliate.id,
      type: "click",
      amount_cents: 0,
    });
    if (error) throw error;

    return json({ recorded: true });
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
