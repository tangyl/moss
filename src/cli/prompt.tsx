import { stdout } from 'process';
import { command, option, string } from 'cmd-ts';
import { openrouter, getTools } from '../core';
import { Agent, AgentObserver } from '../core/agent';
import { getTools } from '../core/tools';
import { getConfigWithLock, releaseConfigLock } from 'src/core/config';
import { createOpenRouter, OpenRouterProvider } from '@openrouter/ai-sdk-provider';
import { Provider } from 'ai';
import { MCPManager } from '../core/mcp';

class ConsoleAgentObserver implements AgentObserver {

  onStreamTextReset(): void {
    stdout.write("\n");
  }

  onStreamText(text: string): void {
    stdout.write(text);
  }

  onFinish(reason: string): void {
  }

  onFinishStep(step: any): void {
    if (step.toolResults) {
      step.toolResults.forEach((toolResult: any) => {
        stdout.write(`🔧 ${toolResult.toolName} `);

        switch (toolResult.toolName) {
          case 'think':
            stdout.write(`${toolResult.args.question} \n`);
            break;
          case 'os_shell_exec':            
            stdout.write(`${toolResult.args.command} \n`);
            break;
          case 'fs_read':
            stdout.write(`${toolResult.args.file_path} \n`);
            break;
          case 'fs_write':
            stdout.write(`${toolResult.args.file_path} \n`);
            break;
          case 'fs_listdir':
            stdout.write(`${toolResult.args.directory_path} \n`);
            break;
          default:
            stdout.write(`${toolResult.args} \n`);
        }
      });
    }
  }
}

export const promptCommand = command({
  name: 'run',
  description: 'Run AI prompt with command line arguments',
  args: {
    prompt: option({
      type: string,
      long: 'prompt',
      short: 'p',
      description: 'The prompt to send to the AI',
    }),
    model: option({
      type: string,
      long: 'model',
      short: 'm',
      description: 'The model to use (default: anthropic/claude-sonnet-4)',
      defaultValue: () => '',
    }),    
    temperature: option({
      type: string,
      long: 'temperature',
      short: 't',
      description: 'Temperature for generation (default: 0.5)',
      defaultValue: () => '0.5',
    }),
    lockTimeout: option({
      type: string,
      long: 'lock-timeout',
      description: 'Config lock timeout in milliseconds (default: 5000)',
      defaultValue: () => '5000',
    }),
  },
  handler: async ({ prompt, model, temperature, lockTimeout }: { 
    prompt: string, 
    model: string, 
    temperature: string,
    lockTimeout: string 
  }) => {

    let config;
    try {
      // Get configuration with automatic locking
      config = await getConfigWithLock(parseInt(lockTimeout));
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
      await mcpManager.initialize(config.configDir + '/mcp.json');

      const agent = new Agent(
        {
          model: provider.chat(model || config.model),
          system: "You are a philosopher. You are smart. Critical thinking is your strength. You are given a question and you need to answer it.",
          tools: getTools(),
          temperature: parseFloat(temperature)
        }
      );

      await agent.initialize();

      const observer = new ConsoleAgentObserver();

      await agent.run(prompt, observer);
    } finally {
      if (mcpManager) {
        await mcpManager.close();
      }
      // Ensure lock is released
      await releaseConfigLock();
    }
  },
});


