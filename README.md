# discord-user-connector

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that gives AI agents access to a Discord **user account** (not a bot account). It talks to the same REST API the official client uses, sends client-like headers, and exposes it as a set of clean, agent-friendly tools.

Run it with [Bun](https://bun.sh). Point your MCP client at it, give it your Discord token, and your agent can read your servers, channels, DMs, mentions and message history — or even send messages on your behalf if you opt in.

## Warning — read this first

Using a user token for automation is against the [Discord Terms of Service](https://discord.com/terms). This is self-bot territory. Accounts that get flagged can lose their token or be suspended without warning — this server paces its requests and mimics a normal client, but there is no safe option, only a less risky one. Use a throwaway or low-value account, never your main one.

Your token is the password to your account. Never paste it into a chat, commit it to a repo, or give it to an MCP server you do not control. Keep it in an environment variable only.

## Features

All tools are prefixed `discord_` by the MCP client.

**Read (always enabled):**

| Tool | What it does |
| --- | --- |
| `whoami` | Your account profile |
| `get_user` | Public profile of any user (bio, badges, connections) |
| `list_guilds` / `get_guild` | Servers you are in; details of one server |
| `list_channels` / `get_channel` | Channels of a server (text, voice, forum, ...); details of one channel |
| `list_members` / `search_members` / `get_member` | Guild member list, member search, single member |
| `list_roles` / `list_emojis` / `list_scheduled_events` / `list_invites` | Server extras |
| `list_voice_states` | Who is currently in voice channels |
| `list_dm_channels` | Your DM and group DM channels |
| `read_messages` / `get_message` | Channel history (accepts message IDs or ISO dates as cursors); single message |
| `search_messages` | Full-text search within a guild, filterable by author/channel/date |
| `list_threads` / `list_pinned_messages` | Threads and pins of a channel |
| `list_mentions` | Recent messages that mention you |
| `export_messages` | Dump a channel's history to a local markdown file (up to 10k messages) |
| `download_attachment` | Download any attachment URL to disk |

**Write (opt-in, disabled by default):**

Set `DISCORD_MCP_WRITE=1` to register these:

| Tool | What it does |
| --- | --- |
| `send_message` / `send_dm` | Send in a channel or DM |
| `edit_message` / `delete_message` | Edit or delete messages |
| `add_reaction` / `remove_reaction` | React / unreact |
| `set_typing` | Trigger the typing indicator |

## Setup

Requires [Bun](https://bun.sh) 1.1+.

```sh
git clone https://github.com/Wqffles-com/discord-user-connector
cd discord-user-connector
bun install
```

Get your token: open the Discord web app in a browser, open DevTools, go to the Network tab, click around in Discord, open any request to `/api/v9/...`, and copy the `Authorization` header value. That string is your token.

Then configure your MCP client. For [opencode](https://opencode.ai), in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "discord": {
      "type": "local",
      "command": ["bun", "run", "/path/to/discord-user-connector/src/index.ts"],
      "enabled": true,
      "timeout": 600000,
      "environment": {
        "DISCORD_TOKEN": "{env:DISCORD_TOKEN}"
      }
    }
  }
}
```

The `{env:DISCORD_TOKEN}` placeholder is resolved from the environment opencode runs in, so the token never lives in the config file. For other clients (Claude Desktop, Cursor, ...), the shape is the same:

```json
{
  "mcpServers": {
    "discord": {
      "command": "bun",
      "args": ["run", "/path/to/discord-user-connector/src/index.ts"],
      "env": { "DISCORD_TOKEN": "your-user-token" }
    }
  }
}
```

## Development

```sh
bun run check   # typecheck
bun test        # unit tests
bun run start   # run the server on stdio
```

The REST client automatically handles 429 rate limits (backs off and retries), 5xx responses, per-request timeouts, and paces all requests with a configurable minimum delay (default 350 ms).

## Disclaimer

This project is for accessing your own account's data. It is not affiliated with or endorsed by Discord. Use it at your own risk — you are responsible for what your agent does with your account, including everything it sends and deletes.

## License

[MIT](LICENSE)
