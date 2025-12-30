import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { appendRow } from "@/lib/sheets";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return NextResponse.json({ ok: false, error: "STRIPE_WEBHOOK_SECRET is missing" }, { status: 500 });

    // 署名検証には “生の本文” が必要
    const rawBody = await req.text();

    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    // 必要なイベントだけ処理
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const email = session.customer_details?.email ?? "";
      const name = session.customer_details?.name ?? "";
      const phone = session.customer_details?.phone ?? "";

      const addr = session.customer_details?.address;
      const addressStr = addr
        ? `${addr.postal_code ?? ""} ${addr.state ?? ""} ${addr.city ?? ""} ${addr.line1 ?? ""} ${addr.line2 ?? ""}`.trim()
        : "";

      // 1行追加（好きな列順にしてOK）
      await appendRow([
        new Date().toISOString(),
        email,
        name,
        phone,
        addressStr,
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
