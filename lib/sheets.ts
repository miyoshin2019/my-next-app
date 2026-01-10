// lib/sheets.ts
import { google } from "googleapis";

type ServiceAccount = { client_email: string; private_key: string };

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is missing`);
  return v;
}

function getServiceAccount(): ServiceAccount {
  const b64 = mustEnv("GOOGLE_SERVICE_ACCOUNT_KEY_B64");
  const json = Buffer.from(b64, "base64").toString("utf8");
  const sa = JSON.parse(json) as ServiceAccount;

  if (!sa.client_email || !sa.private_key) {
    throw new Error("Service account JSON missing client_email/private_key");
  }
  sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  return sa;
}

function getConfig() {
  const spreadsheetId = mustEnv("GOOGLE_SHEETS_ID");
  const sheetName = process.env.GOOGLE_SHEET_NAME || "Data";
  return { spreadsheetId, sheetName };
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
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

// email + stripe_session_id の重複防止（B列=email, F列=session）
export async function existsByEmailAndSession(email: string, stripeSessionId: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rEmail = String(r[1] ?? "").trim(); // B
    const rSession = String(r[5] ?? "").trim(); // F
    if (rEmail === email && rSession === stripeSessionId) return true;
  }
  return false;
}

export type UnsentRow = {
  rowNumber: number; // 1始まり
  email: string;     // B
  name: string;      // C
};

// invite_sent(I列) が FALSE/空 の行を取得
export async function getUnsentRows(limit = 50): Promise<UnsentRow[]> {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:K`,
  });

  const rows = res.data.values ?? [];
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

// invite_sent(I)=TRUE と invite_code(J) を更新
export async function markInviteSent(rowNumber: number, inviteCode: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!I${rowNumber}:J${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [["TRUE", inviteCode]] },
  });
}
export async function setNote(rowNumber: number, note: string) {
  const { spreadsheetId, sheetName } = getConfig();
  const sheets = getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!L${rowNumber}`, // L列(note)
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[note]] },
  });
}
