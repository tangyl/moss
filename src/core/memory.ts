import { type Message } from 'ai';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getConfig } from './config';

export class Memory {
  private readonly filePath: string;
  private messages: Message[] = [];

  constructor() {
    const config = getConfig();
    this.filePath = join(config.configDir, 'memory.jsonl');
  }

  async initDatabase() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const message = JSON.parse(line) as Message;
        this.messages.push(message);
      }
    } catch (error) {
      // Create empty file if it doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.filePath, '', 'utf-8');
      } else {
        throw error;
      }
    }
  }

  private async appendToFile(message: Message) {
    await fs.appendFile(this.filePath, JSON.stringify(message) + '\n', 'utf-8');
  }

  async saveMessage(message: Message): Promise<void> {
    this.messages.push(message);
    await this.appendToFile(message);
  }

  async getMessage(id: string): Promise<Message | null> {
    return this.messages.find(msg => msg.id === id) || null;
  }

  async getAllMessages(): Promise<Message[]> {
    return [...this.messages];
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages = this.messages.filter(msg => msg.id !== id);
    await this.rewriteFile();
  }

  async clearMessages(): Promise<void> {
    this.messages = [];
    await fs.writeFile(this.filePath, '', 'utf-8');
  }

  private async rewriteFile() {
    const content = this.messages
      .map(message => JSON.stringify(message))
      .join('\n') + '\n';
    await fs.writeFile(this.filePath, content, 'utf-8');
  }

  close() {
    // No need to close file as each operation is independent
  }
}