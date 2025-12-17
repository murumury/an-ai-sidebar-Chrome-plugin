import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { McpServerConfig } from "./storage";

interface ConnectedClient {
    client: Client;
    transport: SSEClientTransport | SimpleHttpTransport; // Support both transports
    status: 'connecting' | 'connected' | 'error';
    connectPromise?: Promise<void>;
    serverName?: string;
    errorMessage?: string;
}

interface Transport {
    start(): Promise<void>;
    send(message: any): Promise<void>;
    close(): Promise<void>;
    onmessage?: (message: any) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
}

class SimpleHttpTransport implements Transport {
    onmessage?: (message: any) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;
    private _url: string;

    constructor(url: string) {
        this._url = url;
    }

    async start(): Promise<void> {
        // Stateless, nothing to start
    }

    async send(message: any): Promise<void> {
        try {
            const response = await fetch(this._url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream'
                },
                body: JSON.stringify(message)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP error ${response.status}: ${text}`);
            }

            // Notifications might not return content? Assuming JSON-RPC response always exists for requests
            // JSON-RPC over HTTP: response body is the JSON-RPC response
            const contentLength = response.headers.get('content-length');
            if (contentLength === '0' || response.status === 204) {
                return;
            }

            const contentType = response.headers.get('content-type');
            const text = await response.text();

            if (!text || !text.trim()) {
                // Empty body - assume success (e.g. notification)
                return;
            }

            // Try parsing as JSON first (most common/efficient)
            try {
                const data = JSON.parse(text);
                if (this.onmessage) {
                    this.onmessage(data);
                }
                return;
            } catch (e) {
                // Not JSON, continue to SSE check
            }

            // Try parsing as SSE
            if (text.includes('data:') || contentType?.includes('text/event-stream')) {
                const lines = text.split('\n');
                let foundData = false;
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (this.onmessage) {
                                this.onmessage(data);
                                foundData = true;
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data JSON:', e);
                        }
                    }
                }
                if (foundData) return;
            }

            // If we're here, we couldn't handle the response
            throw new Error(`Unsupported response format. Content-type: ${contentType}. Body preview: ${text.slice(0, 100)}`);
        } catch (e: any) {
            if (this.onerror) {
                this.onerror(e);
            }
            throw e;
        }
    }

    async close(): Promise<void> {
        if (this.onclose) {
            this.onclose();
        }
    }
}

export class McpService {
    private clientMap: Map<string, ConnectedClient> = new Map();

    constructor() { }

    getConnectionStatus(url: string): 'connecting' | 'connected' | 'error' | 'disconnected' {
        return this.clientMap.get(url)?.status || 'disconnected';
    }

    getConnectionError(url: string): string | undefined {
        return this.clientMap.get(url)?.errorMessage;
    }

    async connect(url: string) {
        if (this.clientMap.has(url)) {
            const existing = this.clientMap.get(url);
            if (existing?.status === 'connected') return;
            // If connecting, return existing promise to avoid double-connect
            if (existing?.status === 'connecting' && existing.connectPromise) {
                return existing.connectPromise;
            }
            // If error, disconnect first
            await this.disconnect(url);
        }

        console.log(`MCP: Connecting to ${url}...`);

        // Determine transport type
        let useHttpTransport = false;

        // Create connection promise
        const connectPromise = (async () => {
            let actualClient: Client | null = null;
            let actualTransport: SSEClientTransport | SimpleHttpTransport | null = null;

            try {
                // Diagnostic: Check if URL returns valid SSE headers before connecting
                // This provides a clear error message instead of generic "Invalid content type"
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 5000);
                    // Accept both stream and json to see what server prefers/supports
                    const res = await fetch(url, {
                        method: 'GET',
                        headers: { 'Accept': 'text/event-stream, application/json' },
                        signal: controller.signal
                    });
                    clearTimeout(id);

                    if (res.ok) {
                        const ct = res.headers.get('content-type');

                        // If it is NOT event-stream...
                        if (!ct?.includes('text/event-stream')) {

                            // Check if it IS json (likely HTTP POST JSON-RPC)
                            if (ct?.includes('application/json')) {
                                console.log(`MCP: Detected JSON response for ${url}, switching to HTTP POST transport.`);
                                useHttpTransport = true;
                            } else {
                                // Neither SSE nor JSON - Error
                                let msg = `Invalid content-type. Expected "text/event-stream" or "application/json", received "${ct || 'none'}". Check if the URL is correct.`;
                                throw new Error(msg);
                            }
                        }
                    } else {
                        let msg = `Server returned status ${res.status} ${res.statusText}`;
                        if (res.status === 404) {
                            msg += `\n\nHINT: The endpoint was not found. Common SSE paths include "/sse", "/api/sse", or "/v1/sse". Check your server documentation.`;
                        }
                        try {
                            const text = await res.text();
                            // Only show details if not HTML (HTML is usually a generic 404 page)
                            if (text && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
                                msg += ` Details: ${text.slice(0, 200)}`;
                            }
                        } catch (e) { /* ignore read error */ }
                        throw new Error(msg);
                    }
                    controller.abort();
                } catch (e: any) {
                    // Only rethrow if it's a "real" error we want to report, 
                    // or if it's the specific content-type error we just generated.
                    // Ignore AbortError (timeout/cleanup)
                    if (e.name !== 'AbortError') {
                        throw e;
                    }
                }

                let transport: SSEClientTransport | SimpleHttpTransport;
                if (useHttpTransport) {
                    transport = new SimpleHttpTransport(url);
                } else {
                    transport = new SSEClientTransport(new URL(url));
                }
                actualTransport = transport;

                // Proxy the transport to intercept onmessage and sanitize incorrect fields from user servers
                const proxiedTransport = new Proxy(transport, {
                    set(target, prop, value) {
                        if (prop === 'onmessage' && typeof value === 'function') {
                            const originalHandler = value;
                            // Wrap the handler
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const wrappedHandler = (message: any) => {
                                // Sanitize serverInfo.icons[].sizes if present
                                if (message?.result?.serverInfo?.icons) {
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    message.result.serverInfo.icons.forEach((icon: any) => {
                                        if (icon && !Array.isArray(icon.sizes)) {
                                            // Fix: Default to empty array if missing or invalid type
                                            icon.sizes = [];
                                        }
                                    });
                                }
                                originalHandler(message);
                            };
                            target.onmessage = wrappedHandler;
                            return true;
                        }
                        return Reflect.set(target, prop, value);
                    }
                });

                const client = new Client(
                    {
                        name: "ai-sidebar-extension",
                        version: "1.0.0",
                    },
                    {
                        capabilities: {},
                    }
                );
                actualClient = client;

                // Connect with PROXIED transport
                await client.connect(proxiedTransport);

                // Update the map entry with the actual client and transport
                const entry = this.clientMap.get(url);
                if (entry) {
                    entry.client = actualClient;
                    entry.transport = actualTransport;
                    entry.status = 'connected';
                    entry.connectPromise = undefined; // Clear promise when done
                }
                console.log(`MCP: Connected to ${url} via ${useHttpTransport ? 'HTTP POST' : 'SSE'}`);

            } catch (err) {
                console.error(`MCP: Failed to connect to ${url}`, err);
                const entry = this.clientMap.get(url);
                if (entry) {
                    entry.status = 'error';
                    // Store error message for UI
                    entry.errorMessage = err instanceof Error ? err.message : String(err);
                    entry.connectPromise = undefined;
                }
                // Do not throw here, let the promise resolve (failed state handled by status)
            }
        })();

        // Initial entry with placeholder client and transport.
        // These will be updated once the connectPromise resolves successfully.
        this.clientMap.set(url, { client: null as any, transport: null as any, status: 'connecting', connectPromise });
        return connectPromise;
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
        const enabledConfigs = configs.filter(c => c.enabled);
        const enabledUrls = new Set(enabledConfigs.map(c => c.url));
        const urlToName = new Map(enabledConfigs.map(c => [c.url, c.name]));

        // Connect new/enabled
        const connectPromises = [];
        for (const url of enabledUrls) {
            if (!this.clientMap.has(url) || this.clientMap.get(url)?.status !== 'connected') {
                connectPromises.push(this.connect(url));
            }
            // Update name in client map if changed (even if already connected)
            if (this.clientMap.has(url)) {
                const entry = this.clientMap.get(url)!;
                entry.serverName = urlToName.get(url);
            }
        }

        // Disconnect removed/disabled
        for (const [url] of this.clientMap) {
            if (!enabledUrls.has(url)) {
                await this.disconnect(url);
            }
        }

        // Note: We don't await connectPromises here to keep sync fast, 
        // but listTools will wait for them.
    }

    private toolRouter = new Map<string, string>(); // toolName -> serverUrl

    async listTools() {
        // Wait for any pending connections (with timeout)
        const pendingPromises = [];
        for (const [, entry] of this.clientMap) {
            if (entry.status === 'connecting' && entry.connectPromise) {
                pendingPromises.push(entry.connectPromise);
            }
        }

        if (pendingPromises.length > 0) {
            // Wait up to 2 seconds for connections
            const timeout = new Promise(resolve => setTimeout(resolve, 2000));
            await Promise.race([Promise.all(pendingPromises), timeout]);
        }

        const allTools = [];
        this.toolRouter.clear();
        for (const [url, entry] of this.clientMap) {
            if (entry.status === 'connected') {
                try {
                    const result = await entry.client.listTools();
                    for (const tool of result.tools) {
                        // Append server name to tool object? 
                        // We return a mix of standard Tool + extra metadata if needed by App.tsx
                        // App.tsx uses this to prefix names.
                        allTools.push({ ...tool, serverName: entry.serverName, sourceUrl: url });
                        this.toolRouter.set(tool.name, url); // Keep simple router for backward compat / defaults
                    }
                } catch (e) {
                    console.error(`MCP: listTools failed for ${url}`, e);
                }
            }
        }
        return allTools;
    }

    async getToolsForServer(url: string) {
        const entry = this.clientMap.get(url);
        if (!entry || entry.status !== 'connected') {
            return [];
        }
        try {
            const result = await entry.client.listTools();
            return result.tools;
        } catch (e) {
            console.error(`MCP: getToolsForServer failed for ${url}`, e);
            return [];
        }
    }

    async callTool(name: string, args: any, serverUrl?: string) {
        let url = serverUrl;

        // If no explicit server URL provided, try to find in router
        if (!url) {
            url = this.toolRouter.get(name);
        }

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
