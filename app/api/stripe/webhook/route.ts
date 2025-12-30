// app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { appendRowToSheet } from "@/lib/sheets"; // ←あなたの実装に合わせて

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();

    await appendRowToSheet([
      new Date().toISOString(),
      "stripe-webhook-hit",
      bodyText.slice(0, 100), // 長すぎると邪魔なので先頭だけ
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("webhook error:", e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
