import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DiscordClient } from "./discord.js";
import { registerExportTools } from "./tools-export.js";
import { registerReadTools } from "./tools.js";
import { registerWriteTools } from "./tools-write.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN env var is required");
  process.exit(1);
}
const writeMode = process.env.DISCORD_MCP_WRITE === "1";

const client = new DiscordClient(token);
const server = new McpServer({
  name: "discord-user-connector",
  version: "0.2.0",
});

registerReadTools(server, client);
registerExportTools(server, client);
if (writeMode) {
  registerWriteTools(server, client);
  console.error("write mode ENABLED (DISCORD_MCP_WRITE=1)");
} else {
  console.error("write mode disabled (set DISCORD_MCP_WRITE=1 to enable)");
}

await server.connect(new StdioServerTransport());
console.error("discord-user-connector MCP running on stdio");
