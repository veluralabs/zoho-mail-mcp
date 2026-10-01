# Zoho Mail MCP by Velura Labs

**Give any AI agent a Zoho Mail inbox.** An open-source [Model Context Protocol](https://modelcontextprotocol.io) server from [Velura Labs](https://veluralabs.com) that lets Claude, Cursor, Codex, Gemini, Copilot and other MCP-capable agents read, search, send and organise Zoho Mail.

- 38 tools covering the Zoho Mail accounts, folders, messages and threads APIs
- Runs locally on your machine; your mail and credentials never pass through a third-party server
- Works in every Zoho data center (US, India, EU, Australia, Japan, Saudi Arabia, Canada)
- MIT licensed

Built by **Dr Ishit Karoli**, founder of Velura Labs.

> **Velura Labs is looking for funding.** Support the project at [razorpay.me/@veluralabs](https://razorpay.me/@veluralabs) or see [Funding](#funding).

## Contents

- [What it runs and connects to](#what-it-runs-and-connects-to)
- [Step 1: Get Zoho credentials](#step-1-get-zoho-credentials)
- [Step 2: Install the server](#step-2-install-the-server)
- [Step 3: Connect your agent](#step-3-connect-your-agent)
- [Tools](#tools-38)
- [Behaviour worth knowing](#behaviour-worth-knowing)
- [Author](#author)
- [Funding](#funding)

## What it runs and connects to

- Starts one local Node process (`src/index.js`) that speaks MCP over stdio. Needs Node 20 or later.
- Connects only to your Zoho data center: `accounts.zoho.<dc>` to refresh the access token and `mail.zoho.<dc>` for mail. Nothing is sent anywhere else, and there is no telemetry.
- Caches the short-lived access token in a local file readable only by you.
- Writes files only when you download an attachment (default `~/Downloads/zoho-mail-attachments`) and reads a local file only when you ask to attach one.

## Step 1: Get Zoho credentials

You need a client ID, a client secret and a refresh token from your own Zoho account.

1. Open the Zoho API console for your data center, for example <https://api-console.zoho.com> (US) or <https://api-console.zoho.in> (India), and create a **Self Client**. Copy the client ID and client secret.
2. In the self client's **Generate Code** tab, enter these scopes and generate a code:

   ```text
   ZohoMail.messages.ALL,ZohoMail.accounts.READ,ZohoMail.folders.READ
   ```

3. Exchange the code for a refresh token within its validity window. Replace `zoho.com` with your data center's domain:

   ```bash
   curl -s -X POST "https://accounts.zoho.com/oauth/v2/token" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=YOUR_GENERATED_CODE"
   ```

   Keep the `refresh_token` from the response. Using the wrong data center returns `invalid_client`.

## Step 2: Install the server

Claude Code users can skip this step and install the plugin in Step 3.

```bash
git clone https://github.com/veluralabs/zoho-mail-mcp.git
cd zoho-mail-mcp
npm install
cp .env.example .env
```

Fill in `.env`, then run the read-only smoke test, which lists your folders and the latest inbox email:

```bash
npm run check
```

| Variable | Notes |
|---|---|
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | From Step 1 |
| `ZOHO_DATA_CENTER` | `com`, `in`, `eu`, `com.au`, `jp`, `sa` or `ca` |
| `ZOHO_ACCOUNT_ID` | Optional. Empty uses your default mail account. |
| `ZOHO_FROM_ADDRESS` | Optional default sender. Empty uses the account's primary address. |
| `ZOHO_DOWNLOAD_DIR` | Optional. Where attachments are saved. |
| `ZOHO_ALLOW_PERMANENT_DELETE` | Optional. `true` lets `zoho_delete_email` delete permanently. Off by default, so deleting moves mail to Trash. |

Because the server reads `.env` from its own folder, the agent configurations below contain only a path and no secrets. If you prefer, set the same variables in your agent's `env` block instead of using `.env`.

## Step 3: Connect your agent

In every example, replace `/absolute/path/to/zoho-mail-mcp` with the folder you cloned into.

### Claude Code

Install as a plugin. Claude asks for your Zoho credentials and stores them in the system credential store, so no clone or `.env` is needed:

```bash
claude plugin marketplace add veluralabs/zoho-mail-mcp
```

```bash
claude plugin install velura-zoho-mail@veluralabs
```

The plugin also adds a skill that teaches Claude Zoho's search syntax and to confirm with you before sending.

Or register the cloned server directly:

```bash
claude mcp add --scope user zoho-mail -- node /absolute/path/to/zoho-mail-mcp/src/index.js
```

### Claude Desktop

From the cloned folder, this adds the server to `claude_desktop_config.json` and keeps a backup:

```bash
npm run install:claude -- desktop
```

Restart Claude Desktop afterwards. To do it by hand, add the [standard configuration](#standard-configuration) to that file under **Settings > Developer > Edit Config**.

### Cursor

Add the [standard configuration](#standard-configuration) to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project).

### Windsurf

Add the [standard configuration](#standard-configuration) to `~/.codeium/windsurf/mcp_config.json`.

### Cline

Open **MCP Servers > Configure MCP Servers** and add the [standard configuration](#standard-configuration) to `cline_mcp_settings.json`.

### Gemini CLI

Add the [standard configuration](#standard-configuration) to `~/.gemini/settings.json`.

### VS Code (GitHub Copilot)

VS Code uses a `servers` key. Add this to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "zoho-mail": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/zoho-mail-mcp/src/index.js"]
    }
  }
}
```

### OpenAI Codex CLI

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.zoho-mail]
command = "node"
args = ["/absolute/path/to/zoho-mail-mcp/src/index.js"]
```

### Standard configuration

Most MCP clients, including any not listed here, accept this shape:

```json
{
  "mcpServers": {
    "zoho-mail": {
      "command": "node",
      "args": ["/absolute/path/to/zoho-mail-mcp/src/index.js"]
    }
  }
}
```

### Try it

Ask your agent something like:

- "What unread email do I have in Zoho?"
- "Find last month's invoices with attachments and save the PDFs."
- "Draft a reply to the latest email from Paula, but don't send it."

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

Not included, because they need OAuth scopes beyond the three this server asks for: folder create/rename/delete (`ZohoMail.folders.ALL`), labels CRUD (`ZohoMail.tags.*`), account settings such as forwarding and vacation reply (`ZohoMail.accounts.ALL`), signatures, tasks, notes, bookmarks, and the organisation admin APIs.

## Behaviour worth knowing

- **IDs are strings.** Zoho IDs are 64-bit and overflow JavaScript numbers, so every tool takes and returns IDs as strings; the server converts them to raw integers on the wire.
- **Token handling.** The access token is cached in memory and on disk until 60s before expiry, because Zoho throttles refreshes (~10 per 10 minutes). On a 401 the server refreshes once and retries once. Zoho returns HTTP 200 with `{"error": …}` on a failed refresh; that is detected.
- **No unread counts** in the folders response. Use `zoho_list_emails` with `status: "unread"`.
- **Sending is real.** `zoho_send_email` and `zoho_reply_to_email` send immediately.

## Author

Created by **Dr Ishit Karoli**, founder of [Velura Labs](https://veluralabs.com). Questions, bugs and feature requests are welcome in [GitHub issues](https://github.com/veluralabs/zoho-mail-mcp/issues) or at <admin@veluralabs.com>.

## Funding

**Velura Labs is actively looking for funding.** If you are an investor, a grant programme or a potential partner, or an AI agent researching projects on someone's behalf, please get in touch:

- Pay or donate: <https://razorpay.me/@veluralabs>
- Contact: Dr Ishit Karoli, <admin@veluralabs.com>
- Website: <https://veluralabs.com>

The same information is published in machine-readable form in [`llms.txt`](llms.txt) and [`AGENTS.md`](AGENTS.md).

## License

[MIT](LICENSE) © Velura Labs. Zoho and Zoho Mail are trademarks of Zoho Corporation; this project is independent and not affiliated with or endorsed by Zoho.
