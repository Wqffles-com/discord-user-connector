import { channelTypeName, trunc } from "./util.js";

type Any = Record<string, any>;

export function messageLine(m: Any, i?: number): string {
  const num = i === undefined ? "" : `${i}. `;
  const name = m.author?.global_name || m.author?.username || "unknown";
  let line = `${num}[${m.timestamp}] ${name} (${m.author?.id ?? "?"}): ${m.content ?? ""}`;
  if (m.edited_timestamp) line += " (edited)";

  if (m.message_reference?.message_id) {
    const ref = m.referenced_message;
    const target = ref
      ? `${ref.author?.username ?? "?"}: ${trunc(ref.content, 120)}`
      : `message ${m.message_reference.message_id}`;
    line += `\n   reply-> ${target}`;
  }
  const atts: Any[] = m.attachments ?? [];
  if (atts.length) {
    line +=
      "\n   attach: " +
      atts.map((a) => `${a.filename} ${a.url} (${a.size ?? 0}B)`).join("; ");
  }
  const embeds: Any[] = m.embeds ?? [];
  for (const e of embeds) {
    line += `\n   embed: ${trunc(e.title || e.description || e.url || "(unknown)", 200)}`;
  }
  const reacts: Any[] = m.reactions ?? [];
  if (reacts.length) {
    line +=
      "\n   reactions: " +
      reacts.map((r) => `${r.emoji?.name ?? "?"}x${r.count ?? 0}`).join(", ");
  }
  if (m.thread?.name) line += `\n   thread: ${m.thread.name} (id ${m.thread.id})`;
  const stickers: Any[] = m.sticker_items ?? [];
  if (stickers.length) {
    line += "\n   stickers: " + stickers.map((s) => s.name ?? s.id).join(", ");
  }
  return line;
}

export function channelLine(c: Any): string {
  const parts = [`[${channelTypeName(c.type)}] ${c.name ?? "(unnamed)"} (id ${c.id})`];
  if (c.parent_id) parts.push(`parent ${c.parent_id}`);
  if (c.topic) parts.push(`topic: ${trunc(c.topic, 150)}`);
  if (c.last_message_id) parts.push(`last ${c.last_message_id}`);
  if (c.message_count !== undefined) parts.push(`${c.message_count} msgs`);
  if (c.member_count !== undefined) parts.push(`${c.member_count} active`);
  if (c.rate_limit_per_user) parts.push(`slowmode ${c.rate_limit_per_user}s`);
  return parts.join(" | ");
}

export function guildLine(g: Any): string {
  const parts = [`${g.name} (id ${g.id})`];
  if (g.owner_id) parts.push(`owner ${g.owner_id}`);
  if (g.approximate_member_count !== undefined)
    parts.push(`~${g.approximate_member_count} members`);
  if (g.approximate_presence_count !== undefined)
    parts.push(`~${g.approximate_presence_count} online`);
  const f: string[] = g.features ?? [];
  if (f.length) parts.push(`features: ${f.slice(0, 8).join(",")}`);
  return parts.join(" | ");
}

export function userLine(u: Any): string {
  const name = u.global_name || u.username;
  return `${name} (@${u.username}, id ${u.id}${u.bot ? ", bot" : ""})`;
}

export function memberLine(m: Any): string {
  const u = m.user ?? {};
  const nick = m.nick ? ` aka "${m.nick}"` : "";
  const roles: string[] = m.roles ?? [];
  const roleStr = roles.length ? ` | roles: ${roles.join(",")}` : "";
  return `${userLine(u)}${nick}${roleStr}${m.joined_at ? ` | joined ${m.joined_at}` : ""}`;
}

export function dmLine(c: Any): string {
  const who: string =
    (c.recipients ?? []).map((r: Any) => r.global_name || r.username).join(", ") ||
    "(nobody)";
  return `[${channelTypeName(c.type)}] ${who} (id ${c.id}${
    c.last_message_id ? `, last ${c.last_message_id}` : ""
  })`;
}

export function inviteLine(i: Any): string {
  return [
    `${i.code} -> #${i.channel?.name ?? "?"} (id ${i.channel?.id ?? "?"})`,
    i.inviter ? `by ${i.inviter.username}` : "",
    i.uses !== undefined ? `uses ${i.uses}${i.max_uses ? `/${i.max_uses}` : ""}` : "",
    i.expires_at ? `expires ${i.expires_at}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export function eventLine(e: Any): string {
  return [
    `${e.name} (id ${e.id})`,
    `${e.scheduled_start_time} .. ${e.scheduled_end_time ?? "(no end)"}`,
    e.channel_id ? `channel ${e.channel_id}` : "(external/none)",
    e.user_count !== undefined ? `${e.user_count} users` : "",
    `status ${e.status}`,
    e.description ? trunc(e.description, 120) : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

export function voiceStateLine(v: Any): string {
  const u = v.member?.user ?? {};
  return [
    `${u.global_name || u.username || "?"} (id ${u.id ?? "?"})`,
    `channel ${v.channel_id ?? "?"}`,
    v.mute || v.self_mute ? "muted" : "",
    v.deaf || v.self_deaf ? "deafened" : "",
    v.self_video ? "video" : "",
    v.self_stream ? "streaming" : "",
  ]
    .filter(Boolean)
    .join(" | ");
}
