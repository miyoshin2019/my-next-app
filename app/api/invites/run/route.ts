// app/api/invites/run/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUnsentRows, markInviteSent } from "@/lib/sheets";
import { sendInviteEmail } from "@/lib/resend";

export const runtime = "nodejs";

// ✅ DNS認証が通って送信できるようになったら false にする
const DRY_RUN = false;

// ✅ 暴発防止：1回の実行で送る上限（必要なら変更）
const MAX_PER_RUN = 20;

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function makeInviteCode() {
  return crypto.randomBytes(16).toString("hex"); // 32文字
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // ✅ 実行ガード（token一致のみ）
    const token = url.searchParams.get("token");
    const secret = mustEnv("CRON_SECRET");
    if (token !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    // ✅ 招待URLのベース（あなたのサイトの /invite）
    const inviteBase = mustEnv("DISCORD_INVITE_BASE_URL");

    // 未送信を取得（多くても MAX_PER_RUN まで処理）
    const rows = await getUnsentRows(MAX_PER_RUN);

    let processed = 0;
    let sent = 0;
    const results: Array<{ email: string; rowNumber: number; inviteCode: string; status: string }> = [];

    for (const r of rows) {
      processed++;

      const inviteCode = makeInviteCode();
      const inviteUrl = `${inviteBase}?code=${encodeURIComponent(inviteCode)}`;

      // ✅ DRY_RUN のときは「送らない・更新しない」
      if (DRY_RUN) {
        results.push({ email: r.email, rowNumber: r.rowNumber, inviteCode, status: "dry_run_skipped" });
        continue;
      }

      // ✅ 実送信 → 成功したらシート更新（再送なし運用の最適解）
      await sendInviteEmail({
        to: r.email,
        name: r.name,
        inviteUrl,
        inviteCode,
      });

      await markInviteSent(r.rowNumber, inviteCode);

      sent++;
      results.push({ email: r.email, rowNumber: r.rowNumber, inviteCode, status: "sent_and_marked" });
    }

    return NextResponse.json({
      ok: true,
      dryRun: DRY_RUN,
      processed,
      sent,
      results,
    });
  } catch (e: any) {
    console.error("invites run error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}
