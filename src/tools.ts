import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DiscordClient } from "./discord.js";
import * as F from "./format.js";
import { guard } from "./rpc.js";
import * as U from "./util.js";

type Any = Record<string, any>;

export function registerReadTools(server: McpServer, client: DiscordClient): void {
  server.tool(
    "whoami",
    "Get the authenticated user's Discord account profile",
    { raw: z.boolean().default(false) },
    guard(async ({ raw }) => {
      const me = await client.get<Any>("/users/@me");
      if (raw) return JSON.stringify(me, null, 2);
      return [
        F.userLine(me),
        `email: ${me.email ?? "(hidden)"} | verified: ${me.verified ?? "?"} | mfa: ${me.mfa_enabled ?? "?"} | locale: ${me.locale ?? "?"}`,
        `created: ${U.isoFromSnowflake(me.id)}`,
      ].join("\n");
    }),
  );

  server.tool(
    "get_user",
    "Get a Discord user's public profile by ID (bio, badges, connections, mutual guilds)",
    {
      user_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ user_id, raw }) => {
      const p = await client.get<Any>(`/users/${user_id}/profile`);
      if (raw) return JSON.stringify(p, null, 2);
      const u: Any = p.user ?? {};
      const connections: Any[] = p.connected_accounts ?? [];
      const mutuals: Any[] = p.mutual_guilds ?? [];
      return [
        F.userLine(u),
        u.bio ? `bio: ${U.trunc(u.bio, 300)}` : "",
        u.premium_type ? `premium type: ${u.premium_type}` : "",
        p.badge_ids?.length ? `badges: ${p.badge_ids.join(",")}` : "",
        connections.length
          ? `connections: ${connections.map((a) => `${a.type}:${a.name}`).join(", ")}`
          : "",
        mutuals.length ? `mutual guilds: ${mutuals.map((g) => g.id).join(",")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );

  server.tool(
    "list_guilds",
    "List all Discord servers (guilds) the user is a member of",
    { limit: z.coerce.number().int().min(1).max(200).default(100) },
    guard(async ({ limit }) => {
      const gs = await client.get<Any[]>("/users/@me/guilds", { limit });
      return gs.map(F.guildLine).join("\n") || "(none)";
    }),
  );

  server.tool(
    "get_guild",
    "Get details of a single guild (name, owner, member/online counts)",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const g = await client.get<Any>(`/guilds/${guild_id}`, { with_counts: "true" });
      if (raw) return JSON.stringify(g, null, 2);
      return [
        F.guildLine(g),
        g.description ? `desc: ${U.trunc(g.description, 200)}` : "",
        `created: ${U.isoFromSnowflake(g.id)}`,
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );

  server.tool(
    "list_channels",
    "List channels of a guild (text, voice, forum, categories) sorted by position",
    {
      guild_id: z.string().min(1),
      kind: z.enum(["text", "voice", "all"]).default("text"),
    },
    guard(async ({ guild_id, kind }) => {
      const cs = await client.get<Any[]>(`/guilds/${guild_id}/channels`);
      const want = (c: Any) => {
        if (kind === "all") return true;
        if (kind === "text")
          return [0, 5, 10, 11, 12, 15, 16].includes(c.type);
        return [2, 13].includes(c.type);
      };
      return (
        cs.filter(want)
          .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
          .map(F.channelLine)
          .join("\n") || "(none)"
      );
    }),
  );

  server.tool(
    "get_channel",
    "Get details of a single channel (also works for DMs and threads)",
    {
      channel_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ channel_id, raw }) => {
      const c = await client.get<Any>(`/channels/${channel_id}`);
      if (raw) return JSON.stringify(c, null, 2);
      return c.recipients ? F.dmLine(c) : F.channelLine(c);
    }),
  );

  server.tool(
    "list_members",
    "List members of a guild, paginating automatically up to limit",
    {
      guild_id: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(5000).default(500),
    },
    guard(async ({ guild_id, limit }) => {
      const out: Any[] = [];
      let after: string | undefined;
      while (out.length < limit) {
        const page = await client.get<Any[]>(`/guilds/${guild_id}/members`, {
          limit: Math.min(1000, limit - out.length),
          after,
        });
        if (!page.length) break;
        out.push(...page);
        const last = page[page.length - 1];
        after = last?.user?.id;
        if (!after || page.length < 1000) break;
      }
      return out.map(F.memberLine).join("\n") || "(none)";
    }),
  );

  server.tool(
    "search_members",
    "Search a guild's member list by username or nickname",
    {
      guild_id: z.string().min(1),
      query: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    },
    guard(async ({ guild_id, query, limit }) => {
      const ms = await client.get<Any[]>(`/guilds/${guild_id}/members/search`, {
        query,
        limit,
      });
      return ms.map(F.memberLine).join("\n") || "(no matches)";
    }),
  );

  server.tool(
    "get_member",
    "Get a single guild member (roles, join date, nickname)",
    {
      guild_id: z.string().min(1),
      user_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, user_id, raw }) => {
      const m = await client.get<Any>(`/guilds/${guild_id}/members/${user_id}`);
      if (raw) return JSON.stringify(m, null, 2);
      return F.memberLine(m);
    }),
  );

  server.tool(
    "list_roles",
    "List roles of a guild, sorted from highest to lowest",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const rs = await client.get<Any[]>(`/guilds/${guild_id}/roles`);
      if (raw) return JSON.stringify(rs, null, 2);
      return (
        rs.sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
          .map(
            (r: Any) =>
              `${r.name} (id ${r.id}${r.color ? `, #${r.color.toString(16).padStart(6, "0")}` : ""}${r.managed ? ", managed" : ""})`,
          )
          .join("\n") || "(none)"
      );
    }),
  );

  server.tool(
    "list_emojis",
    "List custom emojis of a guild",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const es = await client.get<Any[]>(`/guilds/${guild_id}/emojis`);
      if (raw) return JSON.stringify(es, null, 2);
      return (
        es.map(
          (e: Any) =>
            `:${e.name}: (id ${e.id}${e.animated ? ", animated" : ""}${e.managed ? ", managed" : ""})`,
        ).join("\n") || "(none)"
      );
    }),
  );

  server.tool(
    "list_scheduled_events",
    "List scheduled events of a guild",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const evs = await client.get<Any[]>(`/guilds/${guild_id}/scheduled-events`, {
        with_user_count: "true",
      });
      if (raw) return JSON.stringify(evs, null, 2);
      return evs.map(F.eventLine).join("\n") || "(none)";
    }),
  );

  server.tool(
    "list_invites",
    "List active invite links of a guild",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const invs = await client.get<Any[]>(`/guilds/${guild_id}/invites`);
      if (raw) return JSON.stringify(invs, null, 2);
      return invs.map(F.inviteLine).join("\n") || "(none)";
    }),
  );

  server.tool(
    "list_voice_states",
    "See who is currently connected to voice/stage channels in a guild",
    {
      guild_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ guild_id, raw }) => {
      const vs = await client.get<Any[]>(`/guilds/${guild_id}/voice-states`);
      if (raw) return JSON.stringify(vs, null, 2);
      return vs.map(F.voiceStateLine).join("\n") || "(nobody in voice)";
    }),
  );

  server.tool(
    "list_dm_channels",
    "List the user's DM and group DM channels, newest activity first",
    { raw: z.boolean().default(false) },
    guard(async ({ raw }) => {
      const cs = await client.get<Any[]>("/users/@me/channels");
      if (raw) return JSON.stringify(cs, null, 2);
      const sorted = cs.sort((a, b) => {
        const av = a.last_message_id ? BigInt(a.last_message_id) : 0n;
        const bv = b.last_message_id ? BigInt(b.last_message_id) : 0n;
        return bv > av ? 1 : bv < av ? -1 : 0;
      });
      return sorted.map(F.dmLine).join("\n") || "(none)";
    }),
  );

  server.tool(
    "read_messages",
    "Read recent messages of a channel in chronological order. before/after accept a message ID or an ISO date (e.g. 2024-06-01)",
    {
      channel_id: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      before: z
        .string()
        .optional()
        .describe("message ID or ISO date; fetch messages older than this"),
      after: z
        .string()
        .optional()
        .describe("message ID or ISO date; fetch messages newer than this"),
      include_system: z.boolean().default(false),
      include_bots: z.boolean().default(true),
      raw: z.boolean().default(false),
    },
    guard(async (a) => {
      const query: Record<string, string | number | undefined> = {
        limit: a.limit,
        before: a.before ? U.coerceSnowflake(a.before) : undefined,
        after: a.after ? U.coerceSnowflake(a.after) : undefined,
      };
      let ms = await client.get<Any[]>(`/channels/${a.channel_id}/messages`, query);
      if (!Array.isArray(ms)) ms = [];
      if (a.raw) return JSON.stringify(ms, null, 2);
      ms = ms.filter(
        (m) =>
          (a.include_system || m.type === 0 || m.type === 19) &&
          (a.include_bots || !m.author?.bot),
      );
      return (
        ms.reverse().map((m, i) => F.messageLine(m, i + 1)).join("\n\n") ||
        "(no messages)"
      );
    }),
  );

  server.tool(
    "get_message",
    "Fetch a single message by ID, including attachments, embeds and reactions",
    {
      channel_id: z.string().min(1),
      message_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ channel_id, message_id, raw }) => {
      const m = await client.get<Any>(
        `/channels/${channel_id}/messages/${message_id}`,
      );
      if (raw) return JSON.stringify(m, null, 2);
      return F.messageLine(m);
    }),
  );

  server.tool(
    "search_messages",
    "Search messages in a guild by content (also filterable by author/channel/date)",
    {
      guild_id: z.string().min(1),
      content: z.string().min(1).describe("search text"),
      author_id: z.string().optional(),
      channel_id: z.string().optional(),
      before: z.string().optional().describe("message ID or ISO date"),
      after: z.string().optional().describe("message ID or ISO date"),
      limit: z.coerce.number().int().min(1).max(25).default(25),
      offset: z.coerce.number().int().min(0).default(0),
      raw: z.boolean().default(false),
    },
    guard(async (a) => {
      const q: Record<string, string | number | undefined> = {
        content: a.content,
        author_id: a.author_id,
        channel_id: a.channel_id,
        min_id: a.after ? U.coerceSnowflake(a.after) : undefined,
        max_id: a.before ? U.coerceSnowflake(a.before) : undefined,
        context_size: 0,
        sort_by: "timestamp",
        sort_order: "desc",
        limit: a.limit,
        offset: a.offset,
      };
      const r = await client.get<Any>(`/guilds/${a.guild_id}/messages/search`, q);
      const groups: Any[] = r.messages ?? [];
      const flat: Any[] = groups.flat();
      if (a.raw)
        return JSON.stringify(
          { total_results: r.total_results, hit: r.hit, messages: flat },
          null,
          2,
        );
      const total: number = r.total_results ?? flat.length;
      const head = `${total} total result(s)${
        total > a.offset + flat.length ? " — raise offset for more" : ""
      }`;
      return (
        head +
        "\n\n" +
        (flat.map((m, i) => F.messageLine(m, i + 1)).join("\n\n") || "(no matches)")
      );
    }),
  );

  server.tool(
    "list_threads",
    "List threads of a channel: active ones or archived (public/private)",
    {
      channel_id: z.string().min(1),
      which: z
        .enum(["active", "archived_public", "archived_private"])
        .default("active"),
      raw: z.boolean().default(false),
    },
    guard(async ({ channel_id, which, raw }) => {
      const path =
        which === "active"
          ? `/channels/${channel_id}/threads/active`
          : `/channels/${channel_id}/threads/archived/${
              which === "archived_public" ? "public" : "private"
            }`;
      const res = await client.get<Any>(path);
      if (raw) return JSON.stringify(res, null, 2);
      const ts: Any[] = res.threads ?? [];
      return (
        ts.map((t: Any) => {
          const meta: Any = t.thread_metadata ?? {};
          return [
            `[${U.channelTypeName(t.type)}] ${t.name} (id ${t.id})`,
            t.message_count !== undefined ? `${t.message_count} msgs` : "",
            meta.archived ? "archived" : "",
            meta.locked ? "locked" : "",
            meta.archive_timestamp ? `archived at ${meta.archive_timestamp}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
        }).join("\n") || "(none)"
      );
    }),
  );

  server.tool(
    "list_pinned_messages",
    "List pinned messages of a channel",
    {
      channel_id: z.string().min(1),
      raw: z.boolean().default(false),
    },
    guard(async ({ channel_id, raw }) => {
      const r = await client.get<Any>(`/channels/${channel_id}/pins`);
      const ms: Any[] = Array.isArray(r)
        ? r
        : ((r.items ?? []).map((i: Any) => i.message).filter(Boolean) as Any[]);
      if (raw) return JSON.stringify(ms, null, 2);
      return ms.map((m, i) => F.messageLine(m, i + 1)).join("\n\n") || "(none)";
    }),
  );

  server.tool(
    "list_mentions",
    "Fetch recent messages that mention the user, across all guilds and DMs",
    {
      limit: z.coerce.number().int().min(1).max(100).default(25),
      before: z.string().optional().describe("message ID or ISO date"),
      after: z.string().optional().describe("message ID or ISO date"),
      guild_id: z.string().optional().describe("restrict to one guild"),
      include_everyone: z
        .boolean()
        .default(true)
        .describe("include @everyone and @role mentions"),
    },
    guard(async (a) => {
      const ms = await client.get<Any[]>("/users/@me/mentions", {
        limit: a.limit,
        before: a.before ? U.coerceSnowflake(a.before) : undefined,
        after: a.after ? U.coerceSnowflake(a.after) : undefined,
        guild_id: a.guild_id,
        role_mention: a.include_everyone ? undefined : "false",
        everyone_mention: a.include_everyone ? undefined : "false",
      });
      return ms.map((m, i) => F.messageLine(m, i + 1)).join("\n\n") || "(no mentions)";
    }),
  );
}
