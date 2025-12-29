import { google } from "googleapis";

function getServiceAccount() {
  // JSON直貼り方式
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (json) return JSON.parse(json);

  // base64方式
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (b64) return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY (or _B64) is missing");
}

export async function appendRowToSheet(values: (string)[]) {
  const sa = getServiceAccount();

  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}
