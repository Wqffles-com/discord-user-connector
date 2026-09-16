import { mkdirSync } from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CLIENT_HEADERS, type DiscordClient } from "./discord.js";
import { guard } from "./rpc.js";
import * as F from "./format.js";
import * as U from "./util.js";

type Any = Record<string, any>;

export function registerExportTools(server: McpServer, client: DiscordClient): void {
  server.tool(
    "export_messages",
    "Export a channel's history to a markdown file. Walks backward from 'before' (or the newest message) up to max_messages",
    {
      channel_id: z.string().min(1),
      path: z.string().optional().describe("output file; default exports/channel_<id>.md"),
      max_messages: z.coerce.number().int().min(1).max(10000).default(500),
      before: z
        .string()
        .optional()
        .describe("message ID or ISO date; start here and go older"),
    },
    guard(async (a) => {
      const collected: Any[] = [];
      let cursor = a.before ? U.coerceSnowflake(a.before) : undefined;
      while (collected.length < a.max_messages) {
        const page = await client.get<Any[]>(`/channels/${a.channel_id}/messages`, {
          limit: 100,
          before: cursor,
        });
        if (!Array.isArray(page) || page.length === 0) break;
        collected.push(...page);
        const oldest = page[page.length - 1];
        if (!oldest?.id) break;
        cursor = oldest.id;
        if (page.length < 100) break;
      }

      const ms = collected.slice(0, a.max_messages);
      ms.reverse();
      const first = ms[0]?.timestamp ?? "?";
      const last = ms[ms.length - 1]?.timestamp ?? "?";
      const header = `# Discord export — channel ${a.channel_id}\n${ms.length} messages, ${first} .. ${last}\n\n`;
      const lines = ms.map((m, i) => F.messageLine(m, i + 1));

      const outPath = path.resolve(process.cwd(), a.path ?? `exports/channel_${a.channel_id}.md`);
      mkdirSync(path.dirname(outPath), { recursive: true });
      await Bun.write(outPath, header + lines.join("\n\n") + "\n");

      return `Exported ${ms.length} messages (${first} .. ${last}) to ${outPath}`;
    }),
  );

  server.tool(
    "download_attachment",
    "Download a file URL (message attachment, avatar, etc.) to disk and return the saved path",
    {
      url: z.string().url(),
      path: z.string().optional().describe("target file; default exports/attachments/<filename>"),
    },
    guard(async ({ url, path: target }) => {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:")
        throw new Error("Only http(s) URLs are supported");
      const res = await fetch(u, {
        headers: { "User-Agent": CLIENT_HEADERS["User-Agent"] },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const name = decodeURIComponent(u.pathname.split("/").pop() || "attachment");
      const outPath = path.resolve(process.cwd(), target ?? `exports/attachments/${name}`);
      mkdirSync(path.dirname(outPath), { recursive: true });
      await Bun.write(outPath, buf);
      return `Saved ${buf.byteLength} bytes to ${outPath}`;
    }),
  );
}
