import { timingSafeEqual } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { DiscordClient } from "./discord.js";
import { createMcpServer } from "./server.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const MCP_PATH = "/mcp";
const HEALTH_PATH = "/health";

export type HttpServerOptions = {
  writeMode: boolean;
  hostname: string;
  port: number;
  token: string;
};

export type HttpServerHandle = {
  url: string;
  close: () => Promise<void>;
};

function rpcError(status: number, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status },
  );
}

function bearerMatches(header: string | null, token: string): boolean {
  if (header === null) return false;
  const provided = Buffer.from(header);
  const expected = Buffer.from(`Bearer ${token}`);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function startHttpServer(
  client: DiscordClient,
  opts: HttpServerOptions,
): HttpServerHandle {
  const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

  async function createSession(req: Request, body: unknown): Promise<Response> {
    let transport: WebStandardStreamableHTTPServerTransport | undefined;
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (sessionId) => {
        if (transport) sessions.set(sessionId, transport);
      },
    });

    const server = createMcpServer(client, opts.writeMode);
    transport.onclose = () => {
      if (transport?.sessionId !== undefined) sessions.delete(transport.sessionId);
      void server.close();
    };

    await server.connect(transport);
    return transport.handleRequest(req, { parsedBody: body });
  }

  async function handleMcp(req: Request): Promise<Response> {
    const sessionId = req.headers.get("mcp-session-id") ?? undefined;

    if (req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return rpcError(400, -32700, "Parse error");
      }

      const existing = sessionId === undefined ? undefined : sessions.get(sessionId);
      if (existing) return existing.handleRequest(req, { parsedBody: body });
      if (sessionId !== undefined) return rpcError(404, -32001, "Session not found");
      if (!isInitializeRequest(body)) {
        return rpcError(400, -32000, "Bad Request: No valid session ID provided");
      }
      return createSession(req, body);
    }

    if (req.method === "GET" || req.method === "DELETE") {
      if (sessionId === undefined) {
        return rpcError(400, -32000, "Bad Request: Mcp-Session-Id header is required");
      }
      const transport = sessions.get(sessionId);
      if (!transport) return rpcError(404, -32001, "Session not found");
      return transport.handleRequest(req);
    }

    return new Response(null, { status: 405, headers: { Allow: "GET, POST, DELETE" } });
  }

  async function route(req: Request, url: URL): Promise<Response> {
    if (url.pathname === HEALTH_PATH) {
      return Response.json({ status: "ok", sessions: sessions.size });
    }
    if (url.pathname !== MCP_PATH) {
      return new Response("Not Found", { status: 404 });
    }
    if (!originAllowed(req)) {
      return new Response("Forbidden", { status: 403 });
    }
    if (!bearerMatches(req.headers.get("authorization"), opts.token)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      });
    }
    return handleMcp(req);
  }

  const server = Bun.serve({
    hostname: opts.hostname,
    port: opts.port,
    fetch: async (req) => {
      const url = new URL(req.url);
      const startedAt = Date.now();
      let res: Response;
      try {
        res = await route(req, url);
      } catch (e) {
        console.error(`[http] ${req.method} ${url.pathname} failed:`, e);
        res = rpcError(500, -32603, "Internal server error");
      }
      console.error(
        `[http] ${req.method} ${url.pathname} -> ${res.status} (${Date.now() - startedAt}ms)`,
      );
      return res;
    },
  });

  const boundPort = server.port;

  return {
    url: `http://${opts.hostname}:${boundPort}${MCP_PATH}`,
    close: async () => {
      const open = [...sessions.values()];
      sessions.clear();
      await Promise.allSettled(open.map((transport) => transport.close()));
      server.stop(true);
    },
  };
}
