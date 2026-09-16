import { DiscordClient } from "../src/discord.js";

const token = process.env.DISCORD_TOKEN!;
const client = new DiscordClient(token);

const guilds = await client.get<any[]>("/users/@me/guilds", { limit: 200 });
const match = guilds.filter((g) => /botanic/i.test(g.name));
if (!match.length) {
  console.log("NO_MATCH. all guilds: " + guilds.map((g) => g.name).join(" | "));
} else {
  for (const g of match) {
    console.log(`GUILD ${g.name} id=${g.id} owner=${g.owner}`);
    const chans = await client.get<any[]>(`/guilds/${g.id}/channels`);
    const texts = chans
      .filter((c) => c.type === 0)
      .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0));
    for (const c of texts) console.log(`  TEXT #${c.name} id=${c.id}`);
  }
}
