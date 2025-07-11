import { stdout } from 'process';
import { command, option, string } from 'cmd-ts';
import { openrouter, getTools } from '../core';
import { Agent, AgentObserver } from '../core/agent';
import { getTools } from '../core/tools';
import { getConfigWithLock, releaseConfigLock } from 'src/core/config';
import { createOpenRouter, OpenRouterProvider } from '@openrouter/ai-sdk-provider';
import { Provider } from 'ai';
import { MCPManager } from '../core/mcp';

// 全局MCPManager实例，用于信号处理器
let globalMcpManager: MCPManager | null = null;

// 设置进程退出信号处理器
function setupSignalHandlers() {
  const cleanup = async (signal: string) => {
    console.log(`\n收到${signal}信号，正在清理资源...`);
    
    try {
      if (globalMcpManager) {
        console.log('正在关闭MCP连接...');
        await globalMcpManager.close();
        console.log('MCP连接已关闭');
      }
      
      await releaseConfigLock();
      console.log('配置锁已释放');
    } catch (error) {
      console.error('清理资源时出错:', error);
    } finally {
      process.exit(0);
    }
  };

  // 处理 Ctrl+C
  process.on('SIGINT', () => cleanup('SIGINT'));
  
  // 处理 kill 命令
  process.on('SIGTERM', () => cleanup('SIGTERM'));
  
  // 处理未捕获的异常
  process.on('uncaughtException', async (error) => {
    console.error('未捕获的异常:', error);
    await cleanup('uncaughtException');
  });
  
  // 处理未处理的Promise拒绝
  process.on('unhandledRejection', async (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    await cleanup('unhandledRejection');
  });
}

class ConsoleAgentObserver implements AgentObserver {

  onStreamTextReset(): void {
    stdout.write("\n");
  }

  onStreamText(text: string): void {
    stdout.write(text);
  }

  onFinish(reason: string): void {
  }

  beforeExecute(toolName: string, args: any): void {
    stdout.write(`🔧 ${toolName} args: ${JSON.stringify(args)} \n`);
  }

  afterExecute(toolName: string, args: any, result: any): void {
    stdout.write(`${toolName} result: ${JSON.stringify(result)} \n`);
  }

  onFinishStep(step: any): void {
  }
}

export const promptCommand =
  command({
    name: 'prompt',
    args: {
      prompt: option({
        type: string,
        long: 'prompt',
        short: 'p',
        description: 'Prompt to ask agent',
      }),
      model: option({
        type: string,
        long: 'model',
        short: 'm',
        description: 'Model to use (default: from config)',
        defaultValue: () => '',
      }),
      temperature: option({
        type: string,
        long: 'temperature',
        short: 't',
        description: 'Temperature for model (default: 0.5)',
        defaultValue: () => '0.5',
      }),
      lockTimeout: option({
        type: string,
        long: 'lock-timeout',
        description: 'Timeout for configuration lock in milliseconds (default: 5000)',
        defaultValue: () => '5000',
      }),
    },
  handler: async ({ prompt, model, temperature, lockTimeout }: { 
    prompt: string, 
    model: string, 
    temperature: string,
    lockTimeout: string 
  }) => {
    
    // 设置信号处理器
    setupSignalHandlers();

    let config;
    try {
      // Get configuration with automatic locking
      const timeoutMs = lockTimeout ? parseInt(lockTimeout) : 5000;
      config = await getConfigWithLock(timeoutMs);
    } catch (error: any) {
      // Show concise message when locked and exit
      console.error('Configuration is in use, please try again later');
      process.exit(1);
    }

    let mcpManager: MCPManager | null = null;

    try {
      let provider: OpenRouterProvider | null = null;  
      if (config.provider === 'openrouter') {
        provider = createOpenRouter({
          apiKey: config.apiKey,
        });
      }

      if (!provider) {
        throw new Error('Provider not found');
      }

      mcpManager = new MCPManager();
      globalMcpManager = mcpManager; // 设置全局引用供信号处理器使用
      await mcpManager.initialize(config.configDir + '/mcp.json');

      const agent = new Agent(
        {
          model: provider.chat(model || config.model),
          system: `You are a philosopher. You are smart. Critical thinking is your strength. You are given a question and you need to answer it."
          You can use tools in parallel.
          `,
          temperature: temperature ? parseFloat(temperature) : 0.5
        }
      );

      await agent.initialize();

      const observer = new ConsoleAgentObserver();

      await agent.run(prompt, observer);
    } catch (error) {
      console.error('执行过程中出错:', error);
      throw error;
    } finally {
      // 确保资源释放
      if (mcpManager) {
        try {
          console.log('正在关闭MCP管理器...');
          await mcpManager.close();
          console.log('MCP管理器已关闭');
        } catch (error) {
          console.error('关闭MCP管理器时出错:', error);
        }
      }
      
      globalMcpManager = null; // 清除全局引用
      
      // Ensure lock is released
      try {
        await releaseConfigLock();
      } catch (error) {
        console.error('释放配置锁时出错:', error);
      }
    }
  },
});


