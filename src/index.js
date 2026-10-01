#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadEnv, zoho, bigId, bigIds, setting } from "./zoho.js";

loadEnv();

const server = new McpServer({ name: "zoho-mail", version: "1.0.0" });

// ---------- shared schema pieces ----------

const id = (what) =>
  z
    .string()
    .regex(/^\d+$/, "must be a numeric ID passed as a string")
    .describe(`${what}. Pass as a string — Zoho IDs are 64-bit and lose precision as JSON numbers.`);
const ids = (what) => z.array(id(what)).min(1);
const folderId = id("Folder ID (from zoho_list_folders)");
const messageId = id("Message ID (from zoho_list_emails / zoho_search_emails)");

const READ = { readOnlyHint: true, openWorldHint: true };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };

function tool(name, description, inputSchema, annotations, handler) {
  server.registerTool(name, { description, inputSchema, annotations }, async (args) => {
    try {
      const out = await handler(args);
      return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e.message }] };
    }
  });
}

const msgPath = (a, tail) => `/folders/${a.folderId}/messages/${a.messageId}${tail}`;
const expandHome = (p) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p);

// ---------- Accounts API (ZohoMail.accounts.READ) ----------

tool(
  "zoho_get_accounts",
  "Get all mail accounts of the authenticated user (accountId, email addresses, display name, storage, send-mail details).",
  {},
  READ,
  () => zoho("GET", "//accounts")
);

tool(
  "zoho_get_account",
  "Get details of one mail account. Defaults to the configured account.",
  { accountId: id("Account ID").optional() },
  READ,
  (a) => zoho("GET", a.accountId ? `//accounts/${a.accountId}` : "")
);

// ---------- Folders API (ZohoMail.folders.READ) ----------

tool(
  "zoho_list_folders",
  "List all folders (folderId, folderName, path, folderType, isArchived). The response has no unread count; use zoho_list_emails with status=unread to find unread mail.",
  {},
  READ,
  () => zoho("GET", "/folders")
);

tool("zoho_get_folder", "Get details of a single folder.", { folderId }, READ, (a) =>
  zoho("GET", `/folders/${a.folderId}`)
);

// ---------- Email Messages API: read ----------

tool(
  "zoho_list_emails",
  "List emails in a folder (or across folders if folderId is omitted), newest first by default. Returns summary, subject, sender, fromAddress, toAddress, messageId, folderId, threadId, receivedTime, status, flagid, hasAttachment.",
  {
    folderId: folderId.optional(),
    start: z.number().int().min(1).optional().describe("1-based starting sequence number (default 1)"),
    limit: z.number().int().min(1).max(200).optional().describe("Number of emails, 1-200 (default 10)"),
    status: z.enum(["read", "unread", "all"]).optional(),
    flagid: z.number().int().min(0).max(3).optional().describe("0 not set, 1 info, 2 important, 3 follow-up"),
    labelid: id("Label ID").optional(),
    threadId: id("Thread ID — list the emails of one conversation").optional(),
    sortBy: z.enum(["date", "messageId", "size"]).optional(),
    sortorder: z.boolean().optional().describe("true ascending, false descending (default)"),
    includeto: z.boolean().optional().describe("Include recipient details"),
    includesent: z.boolean().optional(),
    includearchive: z.boolean().optional(),
    attachedMails: z.boolean().optional().describe("Only emails with attachments"),
    inlinedMails: z.boolean().optional().describe("Only emails with inline images"),
    flaggedMails: z.boolean().optional().describe("Only flagged emails"),
    respondedMails: z.boolean().optional().describe("Only emails that have replies"),
    threadedMails: z.boolean().optional().describe("Only emails that are part of a conversation"),
  },
  READ,
  (a) => zoho("GET", "/messages/view", { query: a })
);

tool(
  "zoho_search_emails",
  `Search emails using Zoho search syntax. searchKey is "parameter:value" terms joined with "::" (AND) or ":or:" (OR).
Parameters: entire:, content:, sender:, to:, cc:, subject:, fileName:, fileContent:, has:attachment (also has:flags, has:convo), in:<folder name>, label:<label name>, fromDate:/toDate: (DD-MMM-YYYY, e.g. fromDate:12-Sep-2025), inclspamtrash:true, groupResult:true. The special key "newMails" returns newly arrived mail.
Example: subject:Invoice::sender:billing@acme.com::has:attachment`,
  {
    searchKey: z.string().min(1),
    receivedTime: z
      .number()
      .int()
      .optional()
      .describe("Unix ms timestamp; only used with searchKey=newMails to fetch mail received after this time"),
    start: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional().describe("1-200 (default 10)"),
    includeto: z.boolean().optional(),
  },
  READ,
  (a) => zoho("GET", "/messages/search", { query: a })
);

tool(
  "zoho_get_email_content",
  "Get the body (HTML) of an email.",
  {
    folderId,
    messageId,
    includeBlockContent: z.boolean().optional().describe("Include quoted/blockquote content from earlier replies"),
  },
  READ,
  (a) => zoho("GET", msgPath(a, "/content"), { query: { includeBlockContent: a.includeBlockContent } })
);

tool(
  "zoho_get_email_metadata",
  "Get metadata of an email (subject, sender, recipients, times, size, status, flag, attachment flags, summary).",
  { folderId, messageId },
  READ,
  (a) => zoho("GET", msgPath(a, "/details"))
);

tool(
  "zoho_get_email_headers",
  "Get the internet message headers of an email (Message-ID, References, Received, authentication results…).",
  { folderId, messageId, raw: z.boolean().optional().describe("true = raw text (default), false = parsed JSON") },
  READ,
  (a) => zoho("GET", msgPath(a, "/header"), { query: { raw: a.raw } })
);

tool(
  "zoho_get_original_message",
  "Get the full original MIME source of an email (headers + all parts).",
  { messageId },
  READ,
  (a) => zoho("GET", `/messages/${a.messageId}/originalmessage`)
);

tool(
  "zoho_get_attachment_info",
  "List the attachments of an email (attachmentId, attachmentName, attachmentSize), optionally with inline images and their cid.",
  { folderId, messageId, includeInline: z.boolean().optional() },
  READ,
  (a) => zoho("GET", msgPath(a, "/attachmentinfo"), { query: { includeInline: a.includeInline } })
);

function saveFile(buffer, fileName, saveTo) {
  const dir = (setting("ZOHO_DOWNLOAD_DIR") && expandHome(setting("ZOHO_DOWNLOAD_DIR"))) || path.join(os.homedir(), "Downloads", "zoho-mail-attachments");
  const target = saveTo ? path.resolve(expandHome(saveTo)) : path.join(dir, path.basename(fileName));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return target;
}

tool(
  "zoho_download_attachment",
  "Download an email attachment to the local disk and return the saved path. Get attachmentId and the name from zoho_get_attachment_info.",
  {
    folderId,
    messageId,
    attachmentId: id("Attachment ID"),
    fileName: z.string().describe("File name to save as (the attachmentName)"),
    saveTo: z.string().optional().describe("Full destination path. Default: ~/Downloads/zoho-mail-attachments/<fileName>"),
  },
  { ...WRITE, openWorldHint: true },
  async (a) => {
    const r = await zoho("GET", msgPath(a, `/attachments/${a.attachmentId}`), { binary: true });
    if (!r.buffer) throw new Error(`Unexpected response: ${JSON.stringify(r)}`);
    return { savedTo: saveFile(r.buffer, a.fileName, a.saveTo), bytes: r.buffer.length, contentType: r.contentType };
  }
);

tool(
  "zoho_download_inline_image",
  "Download an inline image of an email to the local disk. contentId is the cid from zoho_get_attachment_info (includeInline=true).",
  {
    folderId,
    messageId,
    contentId: z.string(),
    fileName: z.string().describe("File name to save as"),
    saveTo: z.string().optional().describe("Full destination path. Default: ~/Downloads/zoho-mail-attachments/<fileName>"),
  },
  WRITE,
  async (a) => {
    const r = await zoho("GET", msgPath(a, "/inline"), {
      query: { contentId: a.contentId, fileName: a.fileName },
      binary: true,
    });
    if (!r.buffer) throw new Error(`Unexpected response: ${JSON.stringify(r)}`);
    return { savedTo: saveFile(r.buffer, a.fileName, a.saveTo), bytes: r.buffer.length, contentType: r.contentType };
  }
);

// ---------- Email Messages API: compose ----------

let primaryAddress;
async function fromAddress(given) {
  if (given) return given;
  if (setting("ZOHO_FROM_ADDRESS")) return setting("ZOHO_FROM_ADDRESS");
  if (!primaryAddress) {
    const acc = await zoho("GET", "");
    primaryAddress = acc.primaryEmailAddress || acc.mailboxAddress || acc.emailAddress?.find((e) => e.isPrimary)?.mailId;
    if (!primaryAddress) throw new Error("Could not determine sender address; pass fromAddress or set ZOHO_FROM_ADDRESS.");
  }
  return primaryAddress;
}

const ENCODINGS = [
  "UTF-8", "Big5", "EUC-JP", "EUC-KR", "GB2312", "ISO-2022-JP", "ISO-8859-1",
  "KOI8-R", "Shift_JIS", "US-ASCII", "WINDOWS-1251", "X-WINDOWS-ISO2022JP",
];

const compose = {
  fromAddress: z.string().optional().describe("Sender address; must belong to this account. Defaults to the account's address."),
  toAddress: z.string().describe("Recipient address(es), comma-separated"),
  ccAddress: z.string().optional().describe("Comma-separated"),
  bccAddress: z.string().optional().describe("Comma-separated"),
  subject: z.string().optional(),
  content: z.string().optional().describe("Email body (HTML unless mailFormat is plaintext)"),
  mailFormat: z.enum(["html", "plaintext"]).optional(),
  askReceipt: z.enum(["yes", "no"]).optional().describe("Request a read receipt"),
  encoding: z.enum(ENCODINGS).optional(),
  attachments: z
    .array(z.object({ storeName: z.string(), attachmentPath: z.string(), attachmentName: z.string() }))
    .optional()
    .describe("Attachment references returned by zoho_upload_attachment"),
};

const schedule = {
  isSchedule: z.boolean().optional().describe("Schedule instead of sending now"),
  scheduleType: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .describe("1 = in 1h, 2 = in 2h, 3 = in 4h, 4 = next morning, 5 = next afternoon, 6 = custom (needs timeZone + scheduleTime)"),
  timeZone: z.string().optional().describe('e.g. "Asia/Kolkata"; required when scheduleType is 6'),
  scheduleTime: z.string().optional().describe("MM/DD/YYYY HH:MM:SS; required when scheduleType is 6"),
};

tool(
  "zoho_send_email",
  "Send an email (optionally with attachments and/or scheduled). This sends real mail immediately — confirm recipients and content with the user first. For attachments, call zoho_upload_attachment first and pass the returned objects.",
  { ...compose, ...schedule },
  WRITE,
  async (a) => zoho("POST", "/messages", { body: { ...a, fromAddress: await fromAddress(a.fromAddress) } })
);

tool(
  "zoho_save_draft",
  "Save an email as a draft or as a template without sending it. To make it a threaded reply draft, set inReplyTo/refHeader from the original email's headers.",
  {
    ...compose,
    toAddress: z.string().optional().describe("Recipient address(es), comma-separated"),
    mode: z.enum(["draft", "template"]).default("draft"),
    inReplyTo: z.string().optional().describe("Message-ID header of the email being replied to, e.g. <abc@zoho.com>"),
    refHeader: z.string().optional().describe("Space-separated Message-IDs of the thread, oldest first"),
  },
  WRITE,
  async (a) => zoho("POST", "/messages", { body: { ...a, fromAddress: await fromAddress(a.fromAddress) } })
);

tool(
  "zoho_reply_to_email",
  "Reply to an existing email (keeps it in the same thread). This sends real mail immediately — confirm with the user first.",
  { messageId, ...compose, ...schedule },
  WRITE,
  async ({ messageId, ...a }) =>
    zoho("POST", `/messages/${messageId}`, {
      body: { ...a, action: "reply", fromAddress: await fromAddress(a.fromAddress) },
    })
);

tool(
  "zoho_upload_attachment",
  "Upload a local file to Zoho so it can be attached to an email. Returns { storeName, attachmentPath, attachmentName } to pass in `attachments` of zoho_send_email / zoho_save_draft / zoho_reply_to_email. With isInline=true also returns a url to use as an <img src> in HTML content.",
  {
    filePath: z.string().describe("Absolute path of the local file"),
    fileName: z.string().optional().describe("Name to show in the email (default: the file's name)"),
    isInline: z.boolean().optional().describe("Upload as an inline image"),
  },
  WRITE,
  (a) => {
    const file = path.resolve(expandHome(a.filePath));
    return zoho("POST", "/messages/attachments", {
      query: { fileName: a.fileName || path.basename(file), isInline: a.isInline },
      rawBody: fs.readFileSync(file),
    });
  }
);

// ---------- Email Messages API + Threads API: updates ----------

const scope = {
  isFolderSpecific: z.boolean().optional().describe("Restrict the action to one folder (then folderId is required)"),
  folderId: folderId.optional(),
};
const archive = { isArchive: z.boolean().optional().describe("Set true when the targets are archived emails") };
const labelIds = ids("Label ID").describe(
  "Label IDs. Note: this server's OAuth grant has no labels scope, so label IDs cannot be listed here; get them from the labelId fields of emails or the Zoho Mail UI."
);

function updateBody(mode, a) {
  const { messageId, threadId, labelId, folderId, destfolderId, ...rest } = a;
  return {
    mode,
    ...rest,
    ...(messageId && { messageId: bigIds(messageId) }),
    ...(threadId && { threadId: bigIds(threadId) }),
    ...(labelId && { labelId: bigIds(labelId) }),
    ...(folderId && { folderId: bigId(folderId) }),
    ...(destfolderId && { destfolderId: bigId(destfolderId) }),
  };
}

// name, mode, description, extra fields — PUT /accounts/{id}/updatemessage
const MESSAGE_UPDATES = [
  ["zoho_mark_emails_read", "markAsRead", "Mark emails as read.", {}],
  ["zoho_mark_emails_unread", "markAsUnread", "Mark emails as unread.", {}],
  [
    "zoho_move_emails",
    "moveMessage",
    "Move emails to another folder.",
    { destfolderId: id("Destination folder ID"), ...scope, ...archive },
  ],
  [
    "zoho_flag_emails",
    "setFlag",
    "Set or clear the flag on emails.",
    { flagid: z.enum(["info", "important", "followup", "flag_not_set"]), ...scope, ...archive },
  ],
  ["zoho_apply_labels_to_emails", "applyLabel", "Apply labels to emails.", { labelId: labelIds, ...scope, ...archive }],
  ["zoho_remove_labels_from_emails", "removeLabel", "Remove specific labels from emails.", { labelId: labelIds, ...scope }],
  ["zoho_remove_all_labels_from_emails", "removeAllLabels", "Remove every label from emails.", scope],
  ["zoho_archive_emails", "archiveMails", "Archive emails. On most accounts this moves them to the Archive folder; use zoho_move_emails to move them back.", {}],
  ["zoho_mark_emails_spam", "moveToSpam", "Mark emails as spam (moves them to the Spam folder).", scope],
  ["zoho_mark_emails_not_spam", "markNotSpam", "Mark emails as not spam.", scope],
];

for (const [name, mode, description, extra] of MESSAGE_UPDATES) {
  tool(
    name,
    `${description} Target individual emails with messageId, or whole conversations with threadId (give one of the two).`,
    { messageId: ids("Message ID").optional(), threadId: ids("Thread ID").optional(), ...extra },
    WRITE,
    (a) => {
      if (!a.messageId && !a.threadId) throw new Error("Provide messageId or threadId.");
      return zoho("PUT", "/updatemessage", { body: updateBody(mode, a) });
    }
  );
}

// PUT /accounts/{id}/updatethread
const threadScope = { ...archive, ...scope };
const THREAD_UPDATES = [
  [
    "zoho_flag_threads",
    "setFlag",
    "Set or clear the flag on whole threads.",
    // Zoho's doc lists 0-3 here, but the API only accepts the same names as updatemessage.
    { flagid: z.enum(["info", "important", "followup", "flag_not_set"]) },
  ],
  [
    "zoho_move_threads",
    "moveMessage",
    "Move whole threads to another folder.",
    { destfolderId: id("Destination folder ID") },
  ],
  ["zoho_apply_labels_to_threads", "applyLabel", "Apply labels to whole threads.", { labelId: labelIds }],
  ["zoho_remove_labels_from_threads", "removeLabel", "Remove specific labels from whole threads.", { labelId: labelIds }],
  ["zoho_remove_all_labels_from_threads", "removeAllLabels", "Remove every label from whole threads.", {}],
  ["zoho_mark_threads_read", "markAsRead", "Mark whole threads as read.", {}],
  ["zoho_mark_threads_unread", "markAsUnread", "Mark whole threads as unread.", {}],
  ["zoho_mark_threads_spam", "moveToSpam", "Mark whole threads as spam.", {}],
  ["zoho_mark_threads_not_spam", "markNotSpam", "Mark whole threads as not spam.", {}],
];

for (const [name, mode, description, extra] of THREAD_UPDATES) {
  tool(name, description, { threadId: ids("Thread ID"), ...extra, ...threadScope }, WRITE, (a) =>
    zoho("PUT", "/updatethread", { body: updateBody(mode, a) })
  );
}

// ---------- Delete ----------

tool(
  "zoho_delete_email",
  "Delete an email. By default it is moved to Trash (recoverable). expunge=true deletes permanently and only works when the server is started with ZOHO_ALLOW_PERMANENT_DELETE=true.",
  { folderId, messageId, expunge: z.boolean().optional().describe("Permanently delete instead of moving to Trash") },
  { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  (a) => {
    if (a.expunge && setting("ZOHO_ALLOW_PERMANENT_DELETE") !== "true") {
      throw new Error("Permanent delete is disabled. Enable it in the plugin configuration (or set ZOHO_ALLOW_PERMANENT_DELETE=true in .env).");
    }
    return zoho("DELETE", msgPath(a, ""), { query: { expunge: a.expunge } });
  }
);

await server.connect(new StdioServerTransport());
