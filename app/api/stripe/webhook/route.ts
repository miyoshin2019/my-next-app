// app/api/stripe/webhook/route.ts
import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { appendRow, existsByEmailAndSession } from "@/lib/sheets";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function normalizeAddress(addr?: Stripe.Address | null) {
  if (!addr) return "";
  return [
    addr.postal_code,
    addr.state,
    addr.city,
    addr.line1,
    addr.line2,
  ].filter(Boolean).join(" ");
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const sig = (await headers()).get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });

    const whsec = process.env.STRIPE_WEBHOOK_SECRET;
    if (!whsec) return NextResponse.json({ ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });

    const event = stripe.webhooks.constructEvent(body, sig, whsec);

    if (event.type !== "checkout.session.completed") {
      // 他イベントは200で返してOK（Stripeは成功扱いになる）
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    // ここから checkout.session.completed
    const rawSession = event.data.object as Stripe.Checkout.Session;

    // ✅ まず retrieve + expand を試す（本番/実決済で安定）
    // ⚠️ ただし Stripe CLI trigger の fixture では retrieve できない事があるので fallback する
    let session: Stripe.Checkout.Session = rawSession;

    try {
      session = await stripe.checkout.sessions.retrieve(rawSession.id, {
        expand: ["customer", "subscription", "customer_details"],
      });
    } catch (e: any) {
      console.warn("checkout.session.retrieve failed, fallback to event payload:", e?.message ?? e);
      // session は rawSession のまま進める
    }

    const email = session.customer_details?.email ?? "";
    const name = session.customer_details?.name ?? "";
    const phone = session.customer_details?.phone ?? "";
    const address = normalizeAddress(session.customer_details?.address);

    const stripeSessionId = session.id ?? "";
    const stripeCustomerId =
      (typeof session.customer === "string" ? session.customer : session.customer?.id) ?? "";
    const stripeSubscriptionId =
      (typeof session.subscription === "string" ? session.subscription : session.subscription?.id) ?? "";

    if (!email || !stripeSessionId) {
      return NextResponse.json({ ok: false, error: "Missing email or session.id" }, { status: 400 });
    }

    // ✅ 重複防止（email + session）
    const exists = await existsByEmailAndSession(email, stripeSessionId);
    if (exists) return NextResponse.json({ ok: true, skipped: true });

    await appendRow([
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }), // A created_at (JST)
      email,                    // B email
      name,                     // C name
      phone,                    // D phone
      address,                  // E address
      stripeSessionId,          // F stripe_session_id
      stripeCustomerId,         // G stripe_customer_id
      stripeSubscriptionId,     // H stripe_subscription_id
      "FALSE",                  // I invite_sent
      "",                       // J invite_code
      "",                       // K discord_id
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("stripe webhook error:", e?.message ?? e);
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
