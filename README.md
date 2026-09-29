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

## Run as a local HTTP server

By default your MCP client spawns this server on stdio. You can instead run it once as a
long-lived process and connect clients to it over HTTP:

```sh
bun run start:http
```

It prints the endpoint, plus a freshly generated bearer token when you did not supply one:

```
discord-user-connector MCP listening on http://127.0.0.1:8787/mcp
auth: generated bearer token -> 4f8c1e2a-...
      set MCP_HTTP_TOKEN to keep it stable across restarts
```

### Environment

| Var | Default | Meaning |
| --- | --- | --- |
| `MCP_HTTP` | unset | `1` runs HTTP instead of stdio |
| `MCP_PORT` | `8787` | Port to listen on, in HTTP mode |
| `MCP_HOST` | `127.0.0.1` | Bind address. Anything else warns loudly on stderr |
| `MCP_HTTP_TOKEN` | generated | Bearer token clients must send |
| `DISCORD_TOKEN` | — | still required |
| `DISCORD_MCP_WRITE` | unset | still gates the write tools |

`MCP_HTTP=1 bun run start` does the same thing, but the `VAR=value command` prefix only works
in bash/zsh — use `bun run start:http` on Windows.

HTTP mode starts only when you ask for it, with `--http` or `MCP_HTTP=1`. `MCP_PORT` and
`MCP_HOST` are read only once HTTP mode is on, so setting them can never push an existing
stdio client over to HTTP by accident.

The server also exposes `GET /health`, which returns `{"status":"ok","sessions":<n>}`.

### Client setup

For [opencode](https://opencode.ai), in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "discord": {
      "type": "remote",
      "url": "http://127.0.0.1:8787/mcp",
      "enabled": true,
      "oauth": false,
      "timeout": 600000,
      "headers": {
        "Authorization": "Bearer {env:MCP_HTTP_TOKEN}"
      }
    }
  }
}
```

`oauth` must be `false`: opencode starts an OAuth flow when it sees a `401`, and this server
uses a static bearer token instead. Bump `timeout` from its 5s default too — `export_messages`
and `list_members` routinely take longer.

### Security

In stdio mode the server is private to the process that spawned it. Over HTTP that stops being
true: anything that can reach the port can read your messages and DMs, and with
`DISCORD_MCP_WRITE=1` can send and delete messages as you. Three things keep that contained,
and all three assume you leave the defaults alone:

- **The bind address.** `127.0.0.1` only. Setting `MCP_HOST=0.0.0.0` exposes your Discord
  account to your entire network — the server warns on stderr when you do this.
- **The bearer token.** Required on every request; compared in constant time. An unset
  `MCP_HTTP_TOKEN` is generated rather than skipped, so the endpoint is never unauthenticated.
- **Origin validation.** Requests carrying an `Origin` header that is not loopback are
  rejected with `403`, which stops a malicious website from POSTing to your localhost. No CORS
  headers are sent, so browsers cannot read responses either.

Anyone with local code execution can still reach the port — treat the token like the Discord
token itself.

### Sanity check

```sh
curl -i http://127.0.0.1:8787/mcp -H "Authorization: Bearer $MCP_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

A `200` with an `mcp-session-id` response header means it is working. Expect `401` without the
header, and `403` if you add a non-loopback `Origin`.

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
