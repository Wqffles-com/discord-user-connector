export const SNOWFLAKE_EPOCH = 1420070400000n;

export function isoFromSnowflake(id: string): string {
  const ms = (BigInt(id) >> 22n) + SNOWFLAKE_EPOCH;
  return new Date(Number(ms)).toISOString();
}

export function snowflakeFromIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid date: ${iso}`);
  return ((BigInt(ms) - SNOWFLAKE_EPOCH) << 22n).toString();
}

export function coerceSnowflake(v: string): string {
  const s = v.trim();
  if (/^\d{15,21}$/.test(s)) return s;
  return snowflakeFromIso(s);
}

const CHANNEL_TYPES: Record<number, string> = {
  0: "text",
  1: "dm",
  2: "voice",
  3: "group_dm",
  4: "category",
  5: "announcement",
  10: "announcement_thread",
  11: "public_thread",
  12: "private_thread",
  13: "stage_voice",
  14: "directory",
  15: "forum",
  16: "media",
  33: "guild_directory",
};

export function channelTypeName(t: number): string {
  return CHANNEL_TYPES[t] ?? `unknown_${t}`;
}

export function trunc(s: string | null | undefined, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + "…";
}
