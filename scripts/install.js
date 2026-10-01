// Registers this server with Claude Code (user scope) and Claude Desktop.
// Usage: npm run install:claude            -> both
//        npm run install:claude -- code    -> Claude Code only
//        npm run install:claude -- desktop -> Claude Desktop only
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const NAME = "zoho-mail";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(root, "src", "index.js");
const node = process.execPath; // absolute path, so Desktop works without a shell PATH
const which = process.argv[2] || "both";

if (!fs.existsSync(path.join(root, ".env"))) {
  console.error("No .env found. Run: cp .env.example .env  and fill in your Zoho credentials first.");
  process.exit(1);
}

if (which !== "desktop") {
  try {
    try {
      execFileSync("claude", ["mcp", "remove", "--scope", "user", NAME], { stdio: "ignore" });
    } catch {}
    execFileSync("claude", ["mcp", "add", "--scope", "user", NAME, "--", node, entry], { stdio: "inherit" });
    console.log("✓ Claude Code: registered (user scope). Check with: claude mcp list");
  } catch (e) {
    console.error(`✗ Claude Code: could not run the claude CLI (${e.message})`);
  }
}

if (which !== "code") {
  const dir =
    process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Application Support", "Claude")
      : process.platform === "win32"
        ? path.join(process.env.APPDATA || "", "Claude")
        : path.join(os.homedir(), ".config", "Claude");
  const file = path.join(dir, "claude_desktop_config.json");
  if (!fs.existsSync(dir)) {
    console.error("✗ Claude Desktop: not installed (config folder missing)");
  } else {
    const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    cfg.mcpServers = { ...cfg.mcpServers, [NAME]: { command: node, args: [entry] } };
    if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
    console.log("✓ Claude Desktop: added to claude_desktop_config.json (backup saved as .bak). Restart the app.");
  }
}
