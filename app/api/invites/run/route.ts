// app/api/invites/run/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUnsentRows, markInviteSent, setNote } from "@/lib/sheets";
import { sendInviteEmail } from "@/lib/resend";

export const runtime = "nodejs";

// ✅ 本番は false（送信する）
// テストで「送らずに動作だけ確認」したい時は true
const DRY_RUN = false;

// ✅ 暴発防止：1回の実行で送る上限
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
    // 例: https://my-next-app-ggsy.vercel.app/invite
    const inviteBase = mustEnv("DISCORD_INVITE_BASE_URL");

    // invite_sent が FALSE/空 の行だけ取得（最大 MAX_PER_RUN）
    const rows = await getUnsentRows(MAX_PER_RUN);

    let processed = 0;
    let sent = 0;

    const results: Array<{
      email: string;
      rowNumber: number;
      inviteCode: string;
      status: string;
      note?: string;
    }> = [];

    for (const r of rows) {
      processed++;

      const inviteCode = makeInviteCode();
      const inviteUrl = `${inviteBase}?code=${encodeURIComponent(inviteCode)}`;

      // ✅ DRY_RUN のときは「送らない・更新しない」（安全）
      if (DRY_RUN) {
        results.push({
          email: r.email,
          rowNumber: r.rowNumber,
          inviteCode,
          status: "dry_run_skipped",
        });
        continue;
      }

      // ✅ 実送信（ここで失敗したら throw → シート更新されない）
      await sendInviteEmail({
        to: r.email,
        name: r.name,
        inviteUrl,
        inviteCode,
      });

      const sentAtIso = new Date().toISOString();

      // ✅ 送信成功後にだけシート更新（再送なし運用の最適解）
      await markInviteSent(r.rowNumber, inviteCode);

      // ✅ L列(note)に送信日時を記録
      const note = `invite_email_sent_at=${sentAtIso}`;
      await setNote(r.rowNumber, note);

      sent++;
      results.push({
        email: r.email,
        rowNumber: r.rowNumber,
        inviteCode,
        status: "sent_and_marked",
        note,
      });
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
