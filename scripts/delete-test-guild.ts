import { DiscordClient } from "../src/discord.js";

const token = process.env.DISCORD_TOKEN!;
const client = new DiscordClient(token);

await client.del(`/guilds/${process.env.GUILD_ID}`);
console.log("DELETED_GUILD=" + process.env.GUILD_ID);
