import { DiscordClient } from "../src/discord.js";

const token = process.env.DISCORD_TOKEN!;
const client = new DiscordClient(token);

const guild = await client.post<any>("/guilds", { name: "duc-write-test" });
console.log("GUILD_ID=" + guild.id);

const channels = await client.get<any[]>(`/guilds/${guild.id}/channels`);
const text = channels.find((c) => c.type === 0);
console.log("CHANNEL_ID=" + text.id);
