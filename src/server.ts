import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DiscordClient } from "./discord.js";
import { registerExportTools } from "./tools-export.js";
import { registerReadTools } from "./tools.js";
import { registerWriteTools } from "./tools-write.js";

export const SERVER_NAME = "discord-user-connector";
export const SERVER_VERSION = "0.2.0";

export function createMcpServer(client: DiscordClient, writeMode: boolean): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerReadTools(server, client);
  registerExportTools(server, client);
  if (writeMode) registerWriteTools(server, client);
  return server;
}
