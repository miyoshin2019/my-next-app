import { google } from "googleapis";

function getServiceAccount() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 is missing");

  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as { client_email: string; private_key: string };
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

function getSheetInfo() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is missing");
  return { spreadsheetId, sheetName };
}

// 1行追加
export async function appendRow(values: (string | number | boolean)[]) {
  const { spreadsheetId, sheetName } = getSheetInfo();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// 既に (email + session_id) の行があるかチェック
export async function existsByEmailAndSession(email: string, sessionId: string) {
  const { spreadsheetId, sheetName } = getSheetInfo();
  const sheets = getSheetsClient();

  // ヘッダー+全行を取得（少人数想定ならこれでOK）
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
  // 1行目はヘッダー想定なので 2行目以降
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rEmail = String(r[1] ?? ""); // B列
    const rSession = String(r[5] ?? ""); // F列
    if (rEmail === email && rSession === sessionId) return true;
  }
  return false;
}
