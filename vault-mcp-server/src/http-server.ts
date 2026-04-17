import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { health } from "./vault-client.ts";
import { config } from "./config.ts";
import { createVaultMcpServer } from "./server.ts";

// Startup health check — log to stderr, never fail
const result = await health();
if (result.includes("not reachable") || result.includes("failed")) {
  console.error(`[vault-mcp-http] Warning: ${result}`);
  console.error(`[vault-mcp-http] Ensure Vault is running at ${config.vaultAddr}`);
} else {
  console.error(`[vault-mcp-http] Connected to Vault at ${config.vaultAddr}`);
  console.error(`[vault-mcp-http] ${result.split("\n")[0]}`);
}
if (!config.vaultToken) {
  console.error("[vault-mcp-http] Warning: VAULT_TOKEN is not set. All secret operations will fail.");
}

const app = createMcpExpressApp({ host: "0.0.0.0" });

app.post("/mcp", async (req, res) => {
  const server = createVaultMcpServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("[vault-mcp-http] Error handling request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

app.delete("/mcp", async (_req, res) => {
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  }));
});

const port = parseInt(process.env.MCP_HTTP_PORT ?? "3100", 10);

app.listen(port, (error?: Error) => {
  if (error) {
    console.error("[vault-mcp-http] Failed to start:", error);
    process.exit(1);
  }
  console.error(`[vault-mcp-http] Listening on 0.0.0.0:${port}`);
});

process.on("SIGINT", () => {
  console.error("[vault-mcp-http] Shutting down...");
  process.exit(0);
});
