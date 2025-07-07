import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { registerTool, removeTool } from './tools';
import * as fs from 'fs';
import { Tool, tool } from 'ai';
import { jsonSchema } from 'ai';

// Helper function: Normalize JSON Schema structure
function normalizeJsonSchema(schema: any): any {
    // If already in standard JSON Schema format, return directly
    if (schema && typeof schema === 'object' && schema.type) {
        return schema;
    }
    
    // If in other format, can add conversion logic here
    return schema;
}

function createMcpTool(client: Client, mcpTool: any): Tool {
    try {
        // Normalize and convert JSON Schema
        const normalizedSchema = normalizeJsonSchema(mcpTool.inputSchema);
        
        return tool({
            description: mcpTool.description,
            parameters: jsonSchema(normalizedSchema),
            execute: async (input: any) => {
                const result = await client.callTool({
                    name: mcpTool.name,
                    arguments: input,
                });
                return result;
            },
        });
    } catch (error) {
        console.error(`Error creating MCP tool ${mcpTool.name}:`, error);
        throw error;
    }
}

export class MCPManager {

    private clients: Map<string, Client>;

    private tools: Map<string, Tool>;

    constructor() {
        this.clients = new Map<string, Client>();
        this.tools = new Map<string, Tool>();
    }

    async close() {
        for (const [name, tool] of this.tools.entries()) {
            removeTool(name);
        }
        this.tools.clear();
        for (const client of this.clients.values()) {
            await client.close();
        }
        this.clients.clear();
    }

    async initialize(configFile: string) {
        // load json file
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

        console.log(config);

        for (const [name, server] of Object.entries(config.mcpServers)) {
            const transport = this.createClientTransport(name, server);
            const client = new Client({
                name: 'moss-mcp-client',
                version: '1.0.0',
                transport: transport,
            });

            client.onerror = (error: any) => {
                console.error(error);
            }

            await client.connect(transport);
            this.clients.set(name, client);
        }

        for (const client of this.clients.values()) {            
            const tools = await client.listTools();
            for (const tool of tools.tools) {
                registerTool(tool.name, createMcpTool(client, tool));
            }
        }
    }

    private createClientTransport(name: string, node: any) {
        if (node.type === 'stdio') {
            return new StdioClientTransport({
                command: node.command,
                args: node.args,
            });
        }
        if (node.type === 'sse') {
            return new SSEClientTransport(new URL(node.url));
        }
        if (node.type === 'mcp') {
            return new StreamableHTTPClientTransport(new URL(node.url));
        }
        if (node.type === 'websocket') {
            return new WebSocketClientTransport(new URL(node.url));
        }
        if (node.command) {
            return new StdioClientTransport({
                command: node.command,
                args: node.args,
            });
        }
        if (node.url) {
            return new SSEClientTransport(new URL(node.url));
        }
        throw new Error(`Unknown transport type: ${node.type}`);
    }
}
