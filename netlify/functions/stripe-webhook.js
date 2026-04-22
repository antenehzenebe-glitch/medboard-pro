// stripe-webhook.js — MedBoard Pro Payment Handler
// ---------------------------------------------------------------
// This function listens for secure messages from Stripe.
// When a user pays, it verifies the cryptographic signature,
// then securely updates their status in Supabase.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL || "https://vhzeeskhvkujihuvddcc.supabase.co";
// CRITICAL: You must use the SERVICE_ROLE_KEY here, not the ANON_KEY.
// This allows the backend to securely bypass Row Level Security (RLS) to update user records.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async function (event) {
  // 1. Reject anything that isn't a POST request
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  // 2. Cryptographically verify the request is actually from Stripe
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // 3. Process the successful payment
  // 'checkout.session.completed' fires when a user successfully pays via a Stripe Checkout link
  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    
    // We assume you pass the Supabase user ID to Stripe when creating the checkout session
    // using the 'client_reference_id' parameter.
    const userId = session.client_reference_id; 

    if (userId) {
      try {
        // 4. Update the user's profile in Supabase to grant Pro access
        const res = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Prefer": "return=minimal"
          },
          body: JSON.stringify({ is_pro: true }) // Update this field based on your actual Supabase schema
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Supabase update failed: HTTP ${res.status} — ${errText}`);
        } else {
          console.log(`Successfully upgraded user: ${userId}`);
        }
      } catch (e) {
        console.error("Database connection error during webhook:", e.message);
      }
    } else {
      console.warn("Payment succeeded, but no client_reference_id (user ID) was attached to the session.");
    }
  }

  // 5. Acknowledge receipt to Stripe immediately to stop retry loops
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};
