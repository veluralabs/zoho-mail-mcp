---
name: zoho-mail
description: How to work with the user's Zoho Mail mailbox through the zoho-mail tools. Use when the user asks to check, read, search, triage, draft, send, reply to, move, flag, archive or delete email in Zoho Mail.
---

# Working with Zoho Mail

The `zoho_*` tools call the Zoho Mail REST API for the user's own mailbox.

## Finding mail

1. Call `zoho_list_folders` once to get folder IDs. The response has no unread counts.
2. For "what's new" or "unread", call `zoho_list_emails` with the Inbox `folderId` and `status: "unread"`.
3. For anything else, use `zoho_search_emails`. `searchKey` is `parameter:value` terms joined with `::` for AND or `:or:` for OR.

| Parameter | Matches |
|---|---|
| `entire:` | the word anywhere in the email |
| `subject:`, `content:` | subject line, body |
| `sender:`, `to:`, `cc:` | addresses |
| `fileName:`, `fileContent:` | attachment name, attachment text |
| `has:attachment` | emails with attachments |
| `in:<folder name>`, `label:<label name>` | location |
| `fromDate:` / `toDate:` | date range, as `12-Sep-2025` |
| `inclspamtrash:true` | also search Spam and Trash |

Example: `subject:Invoice::sender:billing@acme.com::has:attachment`

List and search return summaries only. To read an email, call `zoho_get_email_content` with the `folderId` and `messageId` from the result.

## IDs

Always pass `messageId`, `folderId` and `threadId` as strings, exactly as the tools returned them. They are 64-bit numbers and are corrupted if written as JSON numbers.

## Sending

`zoho_send_email` and `zoho_reply_to_email` send real mail immediately and cannot be undone. A scheduled send waits in the Outbox, where deleting it cancels it; give a custom time as `DD/MM/YYYY HH:MM:SS` (day first). Before calling either, show the user the recipients, subject and body and get a clear yes. When the user only wants something prepared, use `zoho_save_draft`.

To attach a file, call `zoho_upload_attachment` with the local path first, then pass the returned object in `attachments`.

## Organising

The update tools take either `messageId` (individual emails) or `threadId` (whole conversations). Summarise what will change and how many emails are affected before bulk moves, spam marking or deletes. `zoho_delete_email` moves mail to Trash unless the user has enabled permanent delete in the plugin configuration.

To find labelled mail, search with `label:<label name>`. Labels can't be applied or removed one by one; `zoho_remove_all_labels_from_emails` and `zoho_remove_all_labels_from_threads` clear them all.
