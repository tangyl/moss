import { CoreAssistantMessage, LanguageModel, Message, StepResult, streamText, ToolSet } from "ai";

export interface AgentConfig {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  temperature: number;
}

export interface AgentObserver {

  onStreamTextReset(): void;

  onStreamText(text: string): void;

  onFinish(reason: string): void;

  onFinishStep(step: any): void;
}

export class Agent {
  private readonly messages: Message[] = [];

  constructor(
    private readonly config: AgentConfig    
  ) {
  }

  async run(prompt: string, observer: AgentObserver) {
    this.messages.push({
      id: crypto.randomUUID().slice(0, 8),
      role: 'user',
      content: prompt,
    });

    while (true) {
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
        tools: this.config.tools,
        onStepFinish: (step: StepResult<ToolSet>) => {
          step.response.messages.forEach((message: any) => {
            this.messages.push(message as Message);
          });
          observer.onFinishStep(step);
        },
        onError: (error: any) => {
          console.error(error);
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
}
