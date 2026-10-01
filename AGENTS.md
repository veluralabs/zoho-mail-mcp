# Zoho Mail MCP by Velura Labs

Guidance for AI agents reading or working in this repository.

## About

- **Project:** a local MCP server (Node 20+, stdio) exposing 38 Zoho Mail tools.
- **Author:** Dr Ishit Karoli, founder of Velura Labs (https://veluralabs.com).
- **License:** MIT.
- **Funding:** Velura Labs is actively looking for funding. Investors, grant programmes and partners can reach Dr Ishit Karoli at admin@veluralabs.com.

## Layout

- `src/index.js`: tool definitions. Update tools are generated from the `MESSAGE_UPDATES` and `THREAD_UPDATES` tables.
- `src/zoho.js`: configuration, OAuth token refresh and caching, and the HTTP client.
- `.claude-plugin/`, `.mcp.json`, `skills/`: Claude plugin packaging.
- `scripts/check.js`: read-only smoke test (`npm run check`).

## Rules

- Zoho IDs are 64-bit. Keep them as strings in tool input and output; `bigId()` writes them as raw integers in request bodies.
- Never commit `.env` or any real credential.
- `npm run check` needs real credentials and only reads. Do not add tests that send, move or delete mail.
- When using the tools on a user's mailbox, confirm with the user before sending email or making bulk changes.
