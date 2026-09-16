import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordClient } from "./discord.js";
import { guard } from "./rpc.js";

type Any = Record<string, any>;

export function registerWriteTools(server: McpServer, client: DiscordClient): void {
  server.tool(
    "send_message",
    "Send a message to a channel as the user. Reply with reply_to.",
    {
      channel_id: z.string().min(1),
      content: z.string().min(1).max(2000),
      reply_to: z.string().optional().describe("message ID to reply to"),
    },
    guard(async (a) => {
      const m = await client.post<Any>(`/channels/${a.channel_id}/messages`, {
        content: a.content,
        ...(a.reply_to ? { message_reference: { message_id: a.reply_to } } : {}),
      });
      return `Sent message ${m.id} to channel ${a.channel_id}`;
    }),
  );

  server.tool(
    "send_dm",
    "Open (or reuse) a DM channel with a user and send them a message",
    {
      user_id: z.string().min(1),
      content: z.string().min(1).max(2000),
    },
    guard(async (a) => {
      const ch = await client.post<Any>("/users/@me/channels", {
        recipient_id: a.user_id,
      });
      const m = await client.post<Any>(`/channels/${ch.id}/messages`, {
        content: a.content,
      });
      return `Sent DM ${m.id} in channel ${ch.id}`;
    }),
  );

  server.tool(
    "add_reaction",
    "Add a reaction to a message. Use the emoji character itself, or name:id for custom emojis",
    {
      channel_id: z.string().min(1),
      message_id: z.string().min(1),
      emoji: z.string().min(1),
    },
    guard(async (a) => {
      await client.put(
        `/channels/${a.channel_id}/messages/${a.message_id}/reactions/${encodeURIComponent(a.emoji)}/@me`,
      );
      return `Added reaction ${a.emoji}`;
    }),
  );

  server.tool(
    "remove_reaction",
    "Remove the user's reaction from a message",
    {
      channel_id: z.string().min(1),
      message_id: z.string().min(1),
      emoji: z.string().min(1),
    },
    guard(async (a) => {
      await client.del(
        `/channels/${a.channel_id}/messages/${a.message_id}/reactions/${encodeURIComponent(a.emoji)}/@me`,
      );
      return `Removed reaction ${a.emoji}`;
    }),
  );

  server.tool(
    "edit_message",
    "Edit one of the user's own sent messages",
    {
      channel_id: z.string().min(1),
      message_id: z.string().min(1),
      content: z.string().min(1).max(2000),
    },
    guard(async (a) => {
      await client.patch(`/channels/${a.channel_id}/messages/${a.message_id}`, {
        content: a.content,
      });
      return `Edited message ${a.message_id}`;
    }),
  );

  server.tool(
    "delete_message",
    "Delete a message (the user's own, or one they have moderation rights over)",
    {
      channel_id: z.string().min(1),
      message_id: z.string().min(1),
    },
    guard(async (a) => {
      await client.del(`/channels/${a.channel_id}/messages/${a.message_id}`);
      return `Deleted message ${a.message_id}`;
    }),
  );

  server.tool(
    "set_typing",
    "Trigger the typing indicator in a channel (lasts about 10 seconds)",
    { channel_id: z.string().min(1) },
    guard(async ({ channel_id }) => {
      await client.post(`/channels/${channel_id}/typing`);
      return `Typing indicator triggered in ${channel_id}`;
    }),
  );
}
