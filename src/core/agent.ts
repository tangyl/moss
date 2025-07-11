import { LanguageModel, Message, StepResult, streamText, ToolSet } from "ai";
import { Memory } from "./memory";
import { getTools } from "./tools";

export interface AgentConfig {
  model: LanguageModel;
  system: string;
  temperature: number;
}

export interface AgentObserver {

  onStreamTextReset(): void;

  onStreamText(text: string): void;

  onFinish(reason: string): void;

  onFinishStep(step: any): void;

  beforeExecute(toolName: string, args: any): void;

  afterExecute(toolName: string, args: any, result: any): void;
}

export class Agent {
  private readonly messages: Message[] = [];
  private readonly memory: Memory;

  constructor(
    private readonly config: AgentConfig    
  ) {
    this.memory = new Memory();
  }

  async initialize() {
    await this.memory.initDatabase();
    await this.loadHistory();
  }

  async run(prompt: string, observer: AgentObserver) {
    const userMessage: Message = {
      id: crypto.randomUUID().slice(0, 8),
      role: 'user',
      content: prompt,
    };
    
    this.messages.push(userMessage);
    await this.memory.saveMessage(userMessage);
    let break_loop = false;

    while (!break_loop) {
        const result = await streamText({
          model: this.config.model,
          system: this.config.system,
          messages: this.messages,
          maxTokens: 32000,
          temperature: this.config.temperature,
          topP: 1,
          frequencyPenalty: 0,
          presencePenalty: 0,
          stopSequences: [],
          maxSteps: 1,
          tools: getTools({
            beforeExecute: observer.beforeExecute, 
            afterExecute: observer.afterExecute
          }),
          onStepFinish: async (step: StepResult<ToolSet>) => {
            for (const message of step.response.messages) {
              this.messages.push(message as Message);
              await this.memory.saveMessage(message as Message);
            }
            observer.onFinishStep(step);
          },
          onError: (error: any) => {
            break_loop = true;
            console.error(error);
            console.log('!!!Error!!!');
            console.log(error);
            console.log(JSON.stringify(error.error.requestBodyValues, null, 2));
          }          
        });

        observer.onStreamTextReset();

        for await (const text of result.textStream) {
          observer.onStreamText(text);
        }

        const reason = await result.finishReason;

        if (reason !== 'tool-calls') {
          break;
        }

    }
  }

  async loadHistory(): Promise<void> {
    const messages = await this.memory.getAllMessages();
    this.messages.push(...messages);
  }

  async clearHistory(): Promise<void> {
    this.messages.length = 0;
    await this.memory.clearMessages();
  }

  close() {
    this.memory.close();
  }
}
