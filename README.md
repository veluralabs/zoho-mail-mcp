# zoho-mail-mcp

Local MCP server that exposes the Zoho Mail REST API to Claude (Claude Code and Claude Desktop). Runs on your machine over stdio; credentials stay in a local `.env`.

## Install

Needs Node 20+.

```bash
git clone https://github.com/veluralabs/zoho-mail-mcp.git
cd zoho-mail-mcp
npm install
cp .env.example .env    # then fill in the Zoho credentials
npm run check           # read-only smoke test: lists folders + latest inbox email
npm run install:claude  # registers with Claude Code (user scope) and Claude Desktop
```

`npm run install:claude -- code` or `-- desktop` registers with only one of them. Restart Claude Desktop afterwards. The registration contains only the path to `src/index.js` — no secrets.

Manual registration, if you prefer:

```bash
claude mcp add --scope user zoho-mail -- node /absolute/path/to/zoho-mail-mcp/src/index.js
```

## Configuration (`.env`)

| Variable | Notes |
|---|---|
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | OAuth self-client credentials |
| `ZOHO_ACCOUNTS_URL`, `ZOHO_MAIL_API` | Must match your data center. India: `https://accounts.zoho.in` / `https://mail.zoho.in/api`. The wrong region returns `invalid_client`. |
| `ZOHO_ACCOUNT_ID` | Mail account ID |
| `ZOHO_FROM_ADDRESS` | Optional default sender |
| `ZOHO_DOWNLOAD_DIR` | Optional; default `~/Downloads/zoho-mail-attachments` |
| `ZOHO_ALLOW_PERMANENT_DELETE` | Optional; `true` lets `zoho_delete_email` expunge. Off by default (delete moves to Trash). |

Required OAuth scopes: `ZohoMail.messages.ALL`, `ZohoMail.accounts.READ`, `ZohoMail.folders.READ`.

## Tools (38)

Every endpoint in the official docs that those scopes allow. Docs index: <https://www.zoho.com/mail/help/api/>

| Tool | Zoho API |
|---|---|
| **Accounts** | |
| `zoho_get_accounts` | `GET /accounts` — [Get all accounts](https://www.zoho.com/mail/help/api/get-all-users-accounts.html) |
| `zoho_get_account` | `GET /accounts/{id}` — [Get account details](https://www.zoho.com/mail/help/api/get-user-account-details.html) |
| **Folders** | |
| `zoho_list_folders` | `GET /folders` — [Get all folders](https://www.zoho.com/mail/help/api/get-all-folder-details.html) |
| `zoho_get_folder` | `GET /folders/{id}` — [Get a folder](https://www.zoho.com/mail/help/api/get-single-folder-details.html) |
| **Messages: read** | |
| `zoho_list_emails` | `GET /messages/view` — [List emails](https://www.zoho.com/mail/help/api/get-emails-list.html) |
| `zoho_search_emails` | `GET /messages/search` — [Search](https://www.zoho.com/mail/help/api/get-search-emails.html), [search syntax](https://www.zoho.com/mail/help/search-syntax.html) |
| `zoho_get_email_content` | `GET …/messages/{id}/content` — [Content](https://www.zoho.com/mail/help/api/get-email-content.html) |
| `zoho_get_email_metadata` | `GET …/messages/{id}/details` — [Metadata](https://www.zoho.com/mail/help/api/get-email-meta-data.html) |
| `zoho_get_email_headers` | `GET …/messages/{id}/header` — [Headers](https://www.zoho.com/mail/help/api/get-email-header.html) |
| `zoho_get_original_message` | `GET /messages/{id}/originalmessage` — [Original MIME](https://www.zoho.com/mail/help/api/get-original-message.html) |
| `zoho_get_attachment_info` | `GET …/messages/{id}/attachmentinfo` — [Attachment info](https://www.zoho.com/mail/help/api/get-attach-info.html) |
| `zoho_download_attachment` | `GET …/attachments/{id}` — [Attachment content](https://www.zoho.com/mail/help/api/get-attachment-content.html) (saved to disk) |
| `zoho_download_inline_image` | `GET …/messages/{id}/inline` — [Inline image](https://www.zoho.com/mail/help/api/inline-image-download.html) (saved to disk) |
| **Messages: compose** | |
| `zoho_send_email` | `POST /messages` — [Send](https://www.zoho.com/mail/help/api/post-send-an-email.html), [with attachments](https://www.zoho.com/mail/help/api/post-send-email-attachment.html), scheduling |
| `zoho_save_draft` | `POST /messages` (`mode` draft/template) — [Save draft/template](https://www.zoho.com/mail/help/api/post-save-draft-template.html) |
| `zoho_reply_to_email` | `POST /messages/{id}` — [Reply](https://www.zoho.com/mail/help/api/post-reply-to-an-email.html) |
| `zoho_upload_attachment` | `POST /messages/attachments` — [Upload attachment](https://www.zoho.com/mail/help/api/post-upload-attachments.html) |
| **Messages: update** (`PUT /updatemessage`, by `messageId` or `threadId`) | |
| `zoho_mark_emails_read` / `zoho_mark_emails_unread` | modes `markAsRead` / `markAsUnread` |
| `zoho_move_emails` | mode `moveMessage` |
| `zoho_flag_emails` | mode `setFlag` |
| `zoho_apply_labels_to_emails` / `zoho_remove_labels_from_emails` / `zoho_remove_all_labels_from_emails` | modes `applyLabel` / `removeLabel` / `removeAllLabels` |
| `zoho_archive_emails` / `zoho_unarchive_emails` | modes `archiveMails` / `unArchiveMails` |
| `zoho_mark_emails_spam` / `zoho_mark_emails_not_spam` | modes `moveToSpam` / `markNotSpam` |
| `zoho_delete_email` | `DELETE …/messages/{id}` — [Delete](https://www.zoho.com/mail/help/api/delete-email.html) |
| **Threads** (`PUT /updatethread`) | |
| `zoho_flag_threads`, `zoho_move_threads` | modes `setFlag`, `moveMessage` |
| `zoho_apply_labels_to_threads`, `zoho_remove_labels_from_threads`, `zoho_remove_all_labels_from_threads` | modes `applyLabel`, `removeLabel`, `removeAllLabels` |
| `zoho_mark_threads_read`, `zoho_mark_threads_unread` | modes `markAsRead`, `markAsUnread` |
| `zoho_mark_threads_spam`, `zoho_mark_threads_not_spam` | modes `moveToSpam`, `markNotSpam` |

Not included, because the current OAuth grant lacks the scope: folder create/rename/delete (`ZohoMail.folders.ALL`), labels CRUD (`ZohoMail.tags.*`), account settings such as forwarding and vacation reply (`ZohoMail.accounts.ALL`), signatures, tasks, notes, bookmarks, and the organisation admin APIs.

## Behaviour worth knowing

- **IDs are strings.** Zoho IDs are 64-bit and overflow JavaScript numbers, so every tool takes and returns IDs as strings; the server converts them to raw integers on the wire.
- **Token handling.** The access token is cached in memory and in `.token-cache.json` (git-ignored) until 60s before expiry, because Zoho throttles refreshes (~10 per 10 minutes). On a 401 the server refreshes once and retries once. Zoho returns HTTP 200 with `{"error": …}` on a failed refresh; that is detected.
- **No unread counts** in the folders response. Use `zoho_list_emails` with `status: "unread"`.
- **Sending is real.** `zoho_send_email` and `zoho_reply_to_email` send immediately.
