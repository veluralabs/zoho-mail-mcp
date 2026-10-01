// Read-only smoke test: refreshes a token and lists folders + the latest inbox email.
import { loadEnv, zoho } from "../src/zoho.js";

loadEnv();
const folders = await zoho("GET", "/folders");
console.log(`OK — ${folders.length} folders:`, folders.map((f) => f.folderName).join(", "));
const inbox = folders.find((f) => f.folderType === "Inbox");
if (inbox) {
  const [latest] = await zoho("GET", "/messages/view", { query: { folderId: inbox.folderId, limit: 1 } });
  console.log("Latest inbox email:", latest ? `${latest.messageId} — ${latest.subject}` : "(inbox empty)");
}
