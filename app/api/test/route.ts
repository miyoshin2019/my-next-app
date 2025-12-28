import { NextResponse } from "next/server";
import { google } from "googleapis";

function getServiceAccountFromEnv() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is missing");

  const json = Buffer.from(b64, "base64").toString("utf8");
  const sa = JSON.parse(json);

  // private_key に実改行が入っていると壊れることがあるので \n に統一
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

export async function GET() {
  try {
    const sa = getServiceAccountFromEnv();

    const auth = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is missing");

    const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";

    // 1行追加（A列だけでもOK）
    const values = [[new Date().toISOString(), "Sheets に書けたら勝ち"]];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:B`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
