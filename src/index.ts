import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DiscordClient } from "./discord.js";
import { startHttpServer } from "./http.js";
import { createMcpServer } from "./server.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("DISCORD_TOKEN env var is required");
  process.exit(1);
}
const writeMode = process.env.DISCORD_MCP_WRITE === "1";

const client = new DiscordClient(token);

if (writeMode) {
  console.error("write mode ENABLED (DISCORD_MCP_WRITE=1)");
} else {
  console.error("write mode disabled (set DISCORD_MCP_WRITE=1 to enable)");
}

const httpMode = Bun.argv.includes("--http") || process.env.MCP_HTTP === "1";

if (httpMode) {
  const hostname = process.env.MCP_HOST ?? "127.0.0.1";
  const rawPort = process.env.MCP_PORT ?? "8787";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`MCP_PORT must be a port number between 0 and 65535, got "${rawPort}"`);
    process.exit(1);
  }

  const envToken = process.env.MCP_HTTP_TOKEN;
  const authToken = envToken ?? crypto.randomUUID();

  const http = startHttpServer(client, { writeMode, hostname, port, token: authToken });

  console.error(`discord-user-connector MCP listening on ${http.url}`);
  if (envToken) {
    console.error("auth: bearer token from MCP_HTTP_TOKEN");
  } else {
    console.error(`auth: generated bearer token -> ${authToken}`);
    console.error("      set MCP_HTTP_TOKEN to keep it stable across restarts");
  }
  if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
    console.error(
      `WARNING: bound to ${hostname}, which is not loopback. Anyone who can reach this port can read your Discord account and, with DISCORD_MCP_WRITE=1, send messages as you.`,
    );
  }

  const shutdown = async () => {
    await http.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  const server = createMcpServer(client, writeMode);
  await server.connect(new StdioServerTransport());
  console.error("discord-user-connector MCP running on stdio");
}
