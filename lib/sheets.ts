// lib/sheets.ts
import { google } from "googleapis";

/**
 * 環境変数:
 * - GOOGLE_SERVICE_ACCOUNT_KEY_B64: サービスアカウントJSONをbase64した文字列
 * - GOOGLE_SHEETS_ID: スプレッドシートID
 * - GOOGLE_SHEET_NAME: シート名 (例: Data) 省略時は "Data"
 */

type ServiceAccount = { client_email: string; private_key: string };

function getServiceAccount(): ServiceAccount {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is missing");

  const json = Buffer.from(b64, "base64").toString("utf8");
  const sa = JSON.parse(json) as ServiceAccount;

  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON is missing client_email/private_key");
  }

  // private_key の改行が \\n になっているケースの保険
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function getSheetsClient() {
  const sa = getServiceAccount();

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

function getConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is missing");
  return { spreadsheetId, sheetName };
}

// ✅ webhook が import してる名前に合わせる
export async function appendRow(values: (string | number | boolean)[]) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

/**
 * email + stripe_session_id の重複防止
 * 前提: シート列
 * B: email
 * F: stripe_session_id
 *（ヘッダー行が1行目にある想定）
 */
export async function existsByEmailAndSession(email: string, stripeSessionId: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  // B列とF列をまとめて読み
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return false; // ヘッダーだけ

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const emailCell = (r[1] ?? "").toString().trim(); // B
    const sessionCell = (r[5] ?? "").toString().trim(); // F
    if (emailCell === email && sessionCell === stripeSessionId) return true;
  }
  return false;
}
// 追加：未送信(invite_sentがFALSE)行を取得
export type SheetRow = {
  rowNumber: number;            // シート上の行番号(1始まり)
  createdAt: string;            // A
  email: string;                // B
  name: string;                 // C
  phone: string;                // D
  address: string;              // E
  stripeSessionId: string;      // F
  stripeCustomerId: string;     // G
  stripeSubscriptionId: string; // H
  inviteSent: string;           // I ("TRUE"/"FALSE")
  inviteCode: string;           // J
  discordId: string;            // K
};

export async function getUnsentRows(limit = 50): Promise<SheetRow[]> {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];

  const out: SheetRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const inviteSent = String(r[8] ?? "").trim().toUpperCase(); // I列
    const email = String(r[1] ?? "").trim();

    if (!email) continue;

    // invite_sent が FALSE の行だけ
    if (inviteSent === "FALSE" || inviteSent === "") {
      out.push({
        rowNumber: i + 1, // ヘッダーが1行目なので i(0-based)+1
        createdAt: String(r[0] ?? ""),
        email,
        name: String(r[2] ?? ""),
        phone: String(r[3] ?? ""),
        address: String(r[4] ?? ""),
        stripeSessionId: String(r[5] ?? ""),
        stripeCustomerId: String(r[6] ?? ""),
        stripeSubscriptionId: String(r[7] ?? ""),
        inviteSent: inviteSent || "FALSE",
        inviteCode: String(r[9] ?? ""),
        discordId: String(r[10] ?? ""),
      });

      if (out.length >= limit) break;
    }
  }
  return out;
}

// 追加：invite_sent を TRUE にし、invite_code を保存
export async function markInviteSent(rowNumber: number, inviteCode: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  // I列(invite_sent)=TRUE, J列(invite_code)=inviteCode
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!I${rowNumber}:J${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["TRUE", inviteCode]] },
  });
}
// lib/sheets.ts に追記（appendRow / existsByEmailAndSession と同じファイル）

export type UnsentRow = {
  rowNumber: number; // シート上の行番号（1始まり）
  email: string;     // B列
  name: string;      // C列
};

// invite_sent が FALSE（または空）の行を取得
export async function getUnsentRows(limit = 50): Promise<UnsentRow[]> {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
  if (rows.length <= 1) return [];

  const out: UnsentRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];

    const email = String(r[1] ?? "").trim(); // B
    const name = String(r[2] ?? "").trim();  // C
    const inviteSent = String(r[8] ?? "").trim().toUpperCase(); // I

    if (!email) continue;

    if (inviteSent === "FALSE" || inviteSent === "") {
      out.push({ rowNumber: i + 1, email, name });
      if (out.length >= limit) break;
    }
  }

  return out;
}

// invite_sent(TRUE) と invite_code を更新
export async function markInviteSent(rowNumber: number, inviteCode: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!I${rowNumber}:J${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [["TRUE", inviteCode]],
    },
  });
}
