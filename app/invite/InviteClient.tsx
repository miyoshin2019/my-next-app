// app/invite/InviteClient.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function InviteClient() {
  const params = useSearchParams();
  const code = params.get("code") || "";

  const discordUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || "";
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Discord 招待</h1>

      {!code ? (
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <p style={{ margin: 0 }}>
            招待コードが見つかりませんでした。メールのリンクをもう一度開いてください。
          </p>
        </div>
      ) : (
        <div style={{ padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
          <p style={{ marginTop: 0 }}>
            以下の招待コードであなたの購入を確認します。Discordに参加してください。
          </p>

          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 16,
              padding: 12,
              borderRadius: 10,
              background: "#fafafa",
              border: "1px solid #eee",
              wordBreak: "break-all",
              marginBottom: 12,
            }}
          >
            {code}
          </div>

          {!discordUrl ? (
            <p style={{ color: "crimson" }}>
              管理者設定が未完了です：NEXT_PUBLIC_DISCORD_INVITE_URL が未設定です。
            </p>
          ) : (
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                textDecoration: "none",
              }}
            >
              Discord に参加する
            </a>
          )}

          <p style={{ color: "#666", fontSize: 12, marginTop: 12 }}>
            ※このページは招待コードを表示するためのページです。参加後、コードとDiscord IDを紐付けます。
          </p>
        </div>
      )}
    </main>
  );
}
