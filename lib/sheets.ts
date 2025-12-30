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

// 1行追加
export async function appendRow(values: (string | number | boolean)[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";
  if (!spreadsheetId) throw new Error("GOOGLE_SHEETS_ID is missing");

  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}
