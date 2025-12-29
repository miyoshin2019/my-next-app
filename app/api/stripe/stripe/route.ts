import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { appendRowToSheet } from "@/lib/sheets"; // ←あなたの Sheets 追記関数に合わせて変えてOK

export const runtime = "nodejs"; // ←重要: Stripeの署名検証はEdgeだとハマりがちなのでnodejs固定

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });
  }

  // 重要：署名検証には “生のボディ” が必要。req.json() は使わない
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Webhook signature verify failed: ${err.message}` }, { status: 400 });
  }

  try {
    // ✅ まずはこれだけ対応でOK（決済完了）
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email = session.customer_details?.email ?? "";
      const name = session.customer_details?.name ?? "";
      const phone = session.customer_details?.phone ?? "";
      const addr = session.customer_details?.address;

      const addressStr = addr
        ? `${addr.postal_code ?? ""} ${addr.state ?? ""} ${addr.city ?? ""} ${addr.line1 ?? ""} ${addr.line2 ?? ""}`.trim()
        : "";

      // Sheetsに追記（列はあなたのシート構成に合わせて）
      await appendRowToSheet([
        new Date().toISOString(),
        email,
        name,
        phone,
        addressStr,
        "FALSE", // email_sent
        "",      // invite_code
        "",      // discord_id
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
