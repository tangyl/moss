import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { registerTool, removeTool } from './tools';
import * as fs from 'fs';
import { Tool, tool } from 'ai';
import { jsonSchema } from 'ai';
import { z } from 'zod';

// Helper function: Convert JSON Schema to Zod schema
function jsonSchemaToZod(schema: any): z.ZodObject<any> {
    try {
        if (!schema || typeof schema !== 'object') {
            return z.object({});
        }

        const zodShape: any = {};
        
        if (schema.properties && typeof schema.properties === 'object') {
            for (const [key, prop] of Object.entries(schema.properties as any)) {
                const propSchema = prop as any;
                let zodField: any;

                switch (propSchema.type) {
                    case 'string':
                        zodField = z.string();
                        break;
                    case 'number':
                        zodField = z.number();
                        break;
                    case 'integer':
                        zodField = z.number().int();
                        break;
                    case 'boolean':
                        zodField = z.boolean();
                        break;
                    case 'array':
                        zodField = z.array(z.any());
                        break;
                    case 'object':
                        zodField = z.object({});
                        break;
                    default:
                        zodField = z.any();
                }

                if (propSchema.description) {
                    zodField = zodField.describe(propSchema.description);
                }

                // 检查是否为可选字段
                const isRequired = schema.required && Array.isArray(schema.required) && schema.required.includes(key);
                if (!isRequired) {
                    zodField = zodField.optional();
                }

                zodShape[key] = zodField;
            }
        }

        return z.object(zodShape);
    } catch (error) {
        console.error('转换JSON Schema到Zod失败:', error);
        return z.object({});
    }
}

interface ToolSpec {
    description: string;
    parameters: z.ZodObject<any>;
    execute: (args: any) => PromiseLike<any>;
}

function createMcpTool(client: Client, mcpTool: any): ToolSpec {
    try {
        // Convert JSON Schema to Zod schema
        const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);
        
        // 确保description是string类型
        const description = typeof mcpTool.description === 'string' ? mcpTool.description : '无描述';
        
        return {
            description: description,
            parameters: zodSchema,
            execute: async (input: any) => {
                const result = await client.callTool({
                    name: mcpTool.name,
                    arguments: input,
                });
                return result;
            },
        };
    } catch (error) {
        console.error(`Error creating MCP tool ${mcpTool.name}:`, error);
        throw error;
    }
}

export class MCPManager {

    private clients: Map<string, Client>;
    private tools: Map<string, ToolSpec>;
    private isInitialized: boolean = false;
    private isClosed: boolean = false;
    private isClosing: boolean = false;

    constructor() {
        this.clients = new Map<string, Client>();
        this.tools = new Map<string, ToolSpec>();
    }

    async close(timeoutMs: number = 5000): Promise<void> {
        // 确保close方法的幂等性
        if (this.isClosed) {
            console.log('MCPManager已经关闭，跳过重复关闭操作');
            return;
        }

        console.log('正在关闭MCP管理器...');
        this.isClosing = true; // 设置关闭状态标志
        this.isClosed = true;
        
        const closePromise = this.performCleanup();
        
        try {
            // 添加超时机制，防止close操作hang住
            await Promise.race([
                closePromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`关闭操作超时 (${timeoutMs}ms)`)), timeoutMs)
                )
            ]);
            console.log('MCP管理器已成功关闭');
        } catch (error) {
            console.error('关闭MCP管理器时出错:', error);
            // 即使出错也要确保本地状态清理
            this.tools.clear();
            this.clients.clear();
            throw error;
        }
    }

    private async performCleanup(): Promise<void> {
        const errors: Error[] = [];

        // 1. 清理工具注册
        console.log(`正在清理 ${this.tools.size} 个已注册工具...`);
        for (const [name, tool] of this.tools.entries()) {
            try {
                removeTool(name);
            } catch (error) {
                console.error(`清理工具 ${name} 时出错:`, error);
                errors.push(error as Error);
            }
        }
        this.tools.clear();

        // 2. 关闭所有客户端连接
        console.log(`正在关闭 ${this.clients.size} 个MCP客户端连接...`);
        const closePromises = Array.from(this.clients.entries()).map(async ([name, client]) => {
            try {
                // 在关闭前禁用错误处理器，避免打印正常的关闭错误
                client.onerror = undefined;
                await client.close();
                console.log(`客户端 ${name} 已关闭`);
            } catch (error) {
                // 只有非预期的错误才记录
                if (!this.isAbortOrDisconnectError(error)) {
                    console.error(`关闭客户端 ${name} 时出错:`, error);
                    errors.push(new Error(`关闭客户端 ${name} 失败: ${error}`));
                } else {
                    console.log(`客户端 ${name} 连接已正常中断`);
                }
            }
        });

        await Promise.allSettled(closePromises);
        this.clients.clear();

        // 如果有错误，抛出汇总错误
        if (errors.length > 0) {
            const errorMessage = errors.map(e => e.message).join('; ');
            throw new Error(`清理过程中发生 ${errors.length} 个错误: ${errorMessage}`);
        }
    }

    async initialize(configFile: string): Promise<void> {
        if (this.isClosed) {
            throw new Error('无法初始化已关闭的MCPManager');
        }

        if (this.isInitialized) {
            console.log('MCPManager已经初始化，跳过重复初始化');
            return;
        }

        try {
            // load json file
            if (!fs.existsSync(configFile)) {
                throw new Error(`配置文件不存在: ${configFile}`);
            }

            const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            console.log('加载MCP配置:', config);

            if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
                console.log('没有配置MCP服务器，跳过初始化');
                this.isInitialized = true;
                return;
            }

            // 初始化客户端连接
            const clientPromises = Object.entries(config.mcpServers).map(async ([name, server]) => {
                try {
                    const transport = this.createClientTransport(name, server);
                    const client = new Client({
                        name: 'moss-mcp-client',
                        version: '1.0.0',
                        transport: transport,
                    });

                    client.onerror = (error: any) => {
                        // 如果正在关闭且是连接中断错误，则忽略（这是正常的清理过程）
                        if (this.isClosing && this.isAbortOrDisconnectError(error)) {
                            console.log(`MCP客户端 ${name} 正在正常关闭连接`);
                            return;
                        }
                        console.error(`MCP客户端 ${name} 错误:`, error);
                    }

                    await client.connect(transport);
                    this.clients.set(name, client);
                    console.log(`MCP客户端 ${name} 连接成功`);
                } catch (error) {
                    console.error(`连接MCP服务器 ${name} 失败:`, error);
                    throw new Error(`连接MCP服务器 ${name} 失败: ${error}`);
                }
            });

            await Promise.all(clientPromises);

            // 注册工具
            const toolPromises = Array.from(this.clients.entries()).map(async ([clientName, client]) => {
                try {
                    const tools = await client.listTools();
                    console.log(`从客户端 ${clientName} 获取到 ${tools.tools.length} 个工具`);
                    
                    for (const tool of tools.tools) {
                        const toolName = `${clientName}_${tool.name}`;
                        registerTool(toolName, createMcpTool(client, tool));
                        this.tools.set(toolName, createMcpTool(client, tool));
                    }
                } catch (error) {
                    console.error(`从客户端 ${clientName} 获取工具失败:`, error);
                    throw new Error(`从客户端 ${clientName} 获取工具失败: ${error}`);
                }
            });

            await Promise.all(toolPromises);

            this.isInitialized = true;
            console.log(`MCPManager初始化完成，共注册 ${this.tools.size} 个工具`);

        } catch (error) {
            // 初始化失败时清理已创建的资源
            console.error('MCPManager初始化失败，正在清理资源:', error);
            await this.performCleanup().catch(cleanupError => 
                console.error('清理资源时出错:', cleanupError)
            );
            throw error;
        }
    }

    // 获取连接状态
    getStatus(): { initialized: boolean; closed: boolean; clientCount: number; toolCount: number } {
        return {
            initialized: this.isInitialized,
            closed: this.isClosed,
            clientCount: this.clients.size,
            toolCount: this.tools.size
        };
    }

    // 检查是否是正常关闭时的连接中断错误
    private isAbortOrDisconnectError(error: any): boolean {
        if (!error) return false;
        
        const errorMessage = error.message || error.toString() || '';
        const errorName = error.name || '';
        
        // 检查常见的连接中断错误模式
        const disconnectPatterns = [
            'AbortError',
            'This operation was aborted',
            'SSE stream disconnected',
            'WebSocket connection closed',
            'Connection terminated',
            'ECONNRESET',
            'EPIPE'
        ];
        
        return disconnectPatterns.some(pattern => 
            errorMessage.includes(pattern) || errorName.includes(pattern)
        );
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
