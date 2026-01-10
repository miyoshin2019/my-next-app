// lib/resend.ts
import { Resend } from "resend";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

const resend = new Resend(mustEnv("RESEND_API_KEY"));

export type InviteEmailParams = {
  to: string;
  name?: string;
  inviteUrl: string;
  inviteCode: string;
};

/**
 * 招待メール送信（HTML直書き版）
 * - DNS認証後は RESEND_FROM を no-reply@hikari-seeder.com などにする
 */
export async function sendInviteEmail(params: InviteEmailParams) {
  const from = mustEnv("RESEND_FROM");

  const subject = "Discord招待リンクのご案内";
  const safeName = params.name?.trim() ? `${params.name} 様` : "お客様";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.6;">
      <p>${safeName}</p>
      <p>ご購入ありがとうございます。</p>
      <p>下記のリンクからDiscordサーバーに参加してください。</p>

      <p style="margin: 16px 0;">
        <a href="${params.inviteUrl}" target="_blank" rel="noreferrer"
           style="display:inline-block;padding:10px 14px;border-radius:8px;text-decoration:none;border:1px solid #ddd;">
          Discordに参加する
        </a>
      </p>

      <p>招待コード：<b>${params.inviteCode}</b></p>
      <p style="color:#666;font-size:12px;">※このメールは自動送信です。</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from,
    to: [params.to],
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend send failed: ${JSON.stringify(error)}`);
  }
  return data;
}
