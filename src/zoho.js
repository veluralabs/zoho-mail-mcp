import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// As a plugin the install directory is replaced on update, so state goes to the plugin data dir.
const TOKEN_CACHE = path.join(process.env.CLAUDE_PLUGIN_DATA || ROOT, ".token-cache.json");

// Load .env from the repo root so the Claude config never has to hold secrets.
// Real environment variables win over the file.
export function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

// Unset plugin options can arrive as "" or as an unsubstituted "${user_config.x}".
const env = (k) => {
  const v = process.env[k]?.trim();
  return v && !v.startsWith("${") ? v : undefined;
};

// Data center -> hosts. Canada is on zohocloud.ca; the rest follow zoho.<tld>.
function hosts() {
  const dc = (env("ZOHO_DATA_CENTER") || "com").toLowerCase().replace(/^\./, "");
  const domain = dc === "ca" ? "zohocloud.ca" : `zoho.${dc}`;
  return {
    accountsUrl: env("ZOHO_ACCOUNTS_URL") || `https://accounts.${domain}`,
    mailApi: env("ZOHO_MAIL_API") || `https://mail.${domain}/api`,
  };
}

export function config() {
  const need = (k) => {
    const v = env(k);
    if (!v) throw new Error(`Missing ${k}. Set it in the plugin's configuration, or in a .env file in ${ROOT}.`);
    return v;
  };
  const h = hosts();
  return {
    clientId: need("ZOHO_CLIENT_ID"),
    clientSecret: need("ZOHO_CLIENT_SECRET"),
    refreshToken: need("ZOHO_REFRESH_TOKEN"),
    accountsUrl: h.accountsUrl.replace(/\/+$/, ""),
    mailApi: h.mailApi.replace(/\/+$/, ""),
    accountId: env("ZOHO_ACCOUNT_ID"),
  };
}

export const setting = env;

// Zoho IDs are 64-bit and overflow JS numbers. Responses: quote any bare 16+ digit
// integer before JSON.parse. Requests: IDs travel as BigId and are emitted unquoted.
const BIG_INT = /"(?:[^"\\]+|\\.)*"|(?<![\d.eE+\-])-?\d{16,}(?![\d.eE])/g;
export const parseJson = (text) =>
  JSON.parse(text.replace(BIG_INT, (m) => (m[0] === '"' ? m : `"${m}"`)));

const MARK = "\u0000id:";
export const bigId = (v) => `${MARK}${v}`;
export const bigIds = (arr) => arr.map(bigId);
const ID_OUT = new RegExp(`"\\\\u0000id:(\\d+)"`, "g");
export const stringifyBody = (obj) => JSON.stringify(obj).replace(ID_OUT, "$1");

export class ZohoError extends Error {}

let token = null; // { access_token, expiresAt }
let refreshing = null;

function readCache() {
  try {
    const c = JSON.parse(fs.readFileSync(TOKEN_CACHE, "utf8"));
    if (c.refreshToken === config().refreshToken.slice(-8)) return c;
  } catch {}
  return null;
}

async function refresh() {
  const c = config();
  const res = await fetch(`${c.accountsUrl}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
      client_id: c.clientId,
      client_secret: c.clientSecret,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ZohoError(`Token refresh returned non-JSON (HTTP ${res.status})`);
  }
  // Zoho answers HTTP 200 with {"error": "..."} on failure.
  if (!json.access_token) {
    throw new ZohoError(
      `Token refresh failed: ${json.error || "no access_token"}` +
        (json.error === "invalid_client" ? " (check ZOHO_ACCOUNTS_URL matches your data center)" : "")
    );
  }
  token = {
    access_token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    refreshToken: c.refreshToken.slice(-8),
  };
  try {
    fs.writeFileSync(TOKEN_CACHE, JSON.stringify(token), { mode: 0o600 });
  } catch {}
  return token.access_token;
}

// Refreshes are throttled by Zoho (~10 per 10 min), so the token is cached in
// memory and on disk until 60s before expiry and concurrent callers share one refresh.
async function accessToken(force = false) {
  if (!force) {
    token ??= readCache();
    if (token && token.expiresAt - 60_000 > Date.now()) return token.access_token;
  }
  refreshing ??= refresh().finally(() => (refreshing = null));
  return refreshing;
}

// ZOHO_ACCOUNT_ID is optional: without it, use the user's default mail account.
let discoveredAccountId;
async function accountId(c) {
  if (c.accountId) return c.accountId;
  if (!discoveredAccountId) {
    const accounts = await zoho("GET", "//accounts");
    const acc = accounts.find((a) => a.isDefaultAccount) || accounts[0];
    if (!acc) throw new ZohoError("No mail account found for this Zoho user.");
    discoveredAccountId = acc.accountId;
  }
  return discoveredAccountId;
}

/**
 * Call the Mail API. `path` is relative to /accounts/{accountId} unless it starts with "//"
 * (then it is relative to the API base). Returns parsed `data`, or for `binary: true`
 * a { buffer, contentType } pair.
 */
export async function zoho(method, apiPath, { query, body, rawBody, contentType, binary } = {}) {
  const c = config();
  const base = apiPath.startsWith("//")
    ? `${c.mailApi}${apiPath.slice(1)}`
    : `${c.mailApi}/accounts/${await accountId(c)}${apiPath}`;
  const url = new URL(base);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const send = async (force) => {
    const headers = {
      Authorization: `Zoho-oauthtoken ${await accessToken(force)}`,
      // Zoho answers 406 to a JSON-only Accept on the binary download endpoints.
      Accept: binary ? "*/*" : "application/json",
    };
    let payload;
    if (rawBody !== undefined) {
      payload = rawBody;
      headers["Content-Type"] = contentType || "application/octet-stream";
    } else if (body !== undefined) {
      payload = stringifyBody(body);
      headers["Content-Type"] = "application/json";
    }
    return fetch(url, { method, headers, body: payload });
  };

  let res = await send(false);
  if (res.status === 401) res = await send(true); // refresh once, retry once

  const type = res.headers.get("content-type") || "";
  if (binary && res.ok && !type.includes("application/json")) {
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType: type };
  }

  const text = await res.text();
  let json;
  try {
    json = parseJson(text);
  } catch {
    throw new ZohoError(`Zoho returned HTTP ${res.status} with a non-JSON body: ${text.slice(0, 300)}`);
  }
  const code = json?.status?.code;
  if (!res.ok || (code && code >= 400)) {
    const d = json.data || {};
    const detail = [d.errorCode, d.moreInfo].filter(Boolean).join(": ");
    throw new ZohoError(
      `Zoho API error ${code || res.status} ${json?.status?.description || ""}${detail ? ` — ${detail}` : ""}`.trim()
    );
  }
  return json.data ?? json.status;
}
