# Velura Zoho Mail

A Claude plugin that lets Claude read, search, send and organise your Zoho Mail. It bundles a local MCP server that runs on your own machine and talks directly to the Zoho Mail REST API, plus a skill that teaches Claude Zoho's search syntax and to confirm with you before sending.

## What it runs and connects to

- Starts one local Node process (`src/index.js`) over stdio. Needs Node 20 or later.
- Connects only to your Zoho data center: `accounts.zoho.<dc>` to refresh the access token and `mail.zoho.<dc>` for mail. Nothing is sent anywhere else.
- Stores the short-lived access token in a cache file in the plugin's data directory. Your client ID, client secret and refresh token are kept in the system credential store by Claude.
- Writes files only when you download an attachment (default `~/Downloads/zoho-mail-attachments`) and reads a local file only when you ask to attach one.

## Install as a plugin

```bash
claude plugin marketplace add veluralabs/zoho-mail-mcp
```

```bash
claude plugin install velura-zoho-mail@veluralabs
```

Claude then asks for the configuration values below.

| Option | Notes |
|---|---|
| Zoho client ID, client secret, refresh token | From a self client at the Zoho API console for your data center. The refresh token needs the scopes `ZohoMail.messages.ALL`, `ZohoMail.accounts.READ`, `ZohoMail.folders.READ`. |
| Zoho data center | `com`, `in`, `eu`, `com.au`, `jp`, `sa` or `ca`. The wrong one fails with `invalid_client`. |
| Mail account ID | Optional. Empty uses your default mail account. |
| Default sender address | Optional. Empty uses the account's primary address. |
| Allow permanent delete | Off by default, so deleting moves mail to Trash. |

## Run without the plugin system

The same server can be registered directly, with credentials in a local `.env` file instead:

```bash
git clone https://github.com/veluralabs/zoho-mail-mcp.git
cd zoho-mail-mcp
npm install
cp .env.example .env    # then fill in the Zoho credentials
npm run check           # read-only smoke test
npm run install:claude  # registers with Claude Code and Claude Desktop
```

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
- **Token handling.** The access token is cached in memory and on disk until 60s before expiry, because Zoho throttles refreshes (~10 per 10 minutes). On a 401 the server refreshes once and retries once. Zoho returns HTTP 200 with `{"error": …}` on a failed refresh; that is detected.
- **No unread counts** in the folders response. Use `zoho_list_emails` with `status: "unread"`.
- **Sending is real.** `zoho_send_email` and `zoho_reply_to_email` send immediately.
