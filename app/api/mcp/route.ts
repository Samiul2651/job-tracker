import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { safeEqual } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildMcpServer } from "@/lib/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// The secret can come as "Authorization: Bearer <token>" or as ?key=<token>
// (Claude's custom connector form only takes a URL, so the URL carries the key).
function authorized(request: Request): boolean {
  const expected = process.env.MCP_TOKEN;
  if (!expected || expected.length < 24) return false;
  const header = request.headers.get("authorization");
  const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  const key = new URL(request.url).searchParams.get("key");
  const given = bearer || key || "";
  return safeEqual(given, expected);
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401 },
    );
  }
  // Stateless: a fresh server per request, which suits serverless hosting.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildMcpServer(getDb());
  await server.connect(transport);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
