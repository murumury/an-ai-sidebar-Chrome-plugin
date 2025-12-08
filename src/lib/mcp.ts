import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServerConfig } from "./storage";

interface ConnectedClient {
    client: Client;
    transport: SSEClientTransport;
    status: 'connecting' | 'connected' | 'error';
}

export class McpService {
    private clientMap: Map<string, ConnectedClient> = new Map();

    constructor() { }

    getConnectionStatus(url: string): 'connecting' | 'connected' | 'error' | 'disconnected' {
        return this.clientMap.get(url)?.status || 'disconnected';
    }

    async connect(url: string) {
        if (this.clientMap.has(url)) {
            const existing = this.clientMap.get(url);
            if (existing?.status === 'connected') return;
            // If connecting or error, maybe retry? For now, disconnect first if exists
            await this.disconnect(url);
        }

        console.log(`MCP: Connecting to ${url}...`);
        const transport = new SSEClientTransport(new URL(url));
        const client = new Client(
            {
                name: "ai-sidebar-extension",
                version: "1.0.0",
            },
            {
                capabilities: {},
            }
        );

        this.clientMap.set(url, { client, transport, status: 'connecting' });

        try {
            await client.connect(transport);
            const entry = this.clientMap.get(url);
            if (entry) entry.status = 'connected';
            console.log(`MCP: Connected to ${url}`);
        } catch (err) {
            console.error(`MCP: Failed to connect to ${url}`, err);
            const entry = this.clientMap.get(url);
            if (entry) entry.status = 'error';
            throw err;
        }
    }

    async disconnect(url: string) {
        const entry = this.clientMap.get(url);
        if (entry) {
            try {
                await entry.client.close();
                await entry.transport.close();
            } catch (e) {
                console.error(`MCP: Cleanup error for ${url}`, e);
            }
            this.clientMap.delete(url);
            console.log(`MCP: Disconnected ${url}`);
        }
    }

    async syncServers(configs: McpServerConfig[]) {
        const enabledUrls = new Set(configs.filter(c => c.enabled).map(c => c.url));

        // Connect new/enabled
        for (const url of enabledUrls) {
            if (!this.clientMap.has(url) || this.clientMap.get(url)?.status !== 'connected') {
                this.connect(url).catch(err => console.error("Auto-connect failed for", url, err));
            }
        }

        // Disconnect removed/disabled
        for (const [url] of this.clientMap) {
            if (!enabledUrls.has(url)) {
                await this.disconnect(url);
            }
        }
    }

    private toolRouter = new Map<string, string>(); // toolName -> serverUrl

    async listTools() {
        const allTools = [];
        this.toolRouter.clear();
        for (const [url, entry] of this.clientMap) {
            if (entry.status === 'connected') {
                try {
                    const result = await entry.client.listTools();
                    for (const tool of result.tools) {
                        allTools.push(tool);
                        this.toolRouter.set(tool.name, url);
                    }
                } catch (e) {
                    console.error(`MCP: listTools failed for ${url}`, e);
                }
            }
        }
        return allTools;
    }

    async callTool(name: string, args: any) {
        const url = this.toolRouter.get(name);
        if (!url) throw new Error(`Tool ${name} not found`);

        const entry = this.clientMap.get(url);
        if (!entry || entry.status !== 'connected') {
            throw new Error(`Server for tool ${name} is not connected`);
        }

        console.log(`MCP: Calling tool ${name} on ${url}`);
        return await entry.client.callTool({
            name,
            arguments: args
        });
    }
}

export const mcpService = new McpService();
