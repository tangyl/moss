import { Tool, tool, ToolExecutionOptions } from "ai";
import { execSync } from 'child_process';
import { z } from 'zod';
import fs from 'fs';
import { type ToolSet } from "ai";

interface ToolSpec {
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => PromiseLike<any>;
}

const toolRegistry: Record<string, ToolSpec> = {};

export function registerTool(name: string, spec: ToolSpec) {
  toolRegistry[name] = spec;
}

export function removeTool(name: string) {
  delete toolRegistry[name];
}

export function getTool(name: string) {
  return toolRegistry[name];
}


const wrapError = (fn: (...args: any[]) => any) => {
  return (...args: any[]) => {
    try {
      const result = fn(...args);
      
      // 检查结果是否为 Promise
      if (result && typeof result.then === 'function') {
        return result.catch((error: Error) => {
          console.error(error);
          return {
            error: error.message,
          };
      });
      }
      
      return result;
    } catch (error) {
      console.error(error);
      return {
        error: (error as Error).message,
      }
    }
  }
}

export function getTools(callbacks: { beforeExecute: (toolName: string, args: any) => void, afterExecute: (toolName: string, args: any, result: any) => void }): ToolSet {
  const tools: ToolSet = {};
  for (const [name, spec] of Object.entries(toolRegistry)) {
    tools[name] = tool({
      description: spec.description,
      parameters: spec.parameters,
      execute: wrapError(async (args) => {
        callbacks.beforeExecute(name, args);
        const result = await spec.execute(args);
        callbacks.afterExecute(name, args, result);

        console.log('result', result);
        return result;
      })
    });
  }
  return tools;
}

registerTool('Think', {
  description: 'Think about the current situation and the best course of action.',
  parameters: z.object({
    question: z.string().describe('The question to think about'),
  }),
  execute: async ({ question }) => ({
    answer: "That's a good idea."
  }),
});

registerTool('FileRead', {
  description: 'Read from a file.',
  parameters: z.object({
    file_path: z.string().describe('The path to the file to read from'),
  }),
  execute: async ({ file_path }) => ({
    file_path,
    content: fs.readFileSync(file_path, 'utf8'),
  }),
});

registerTool('FileWrite', {
  description: 'Write to a file.',
  parameters: z.object({
    file_path: z.string().describe('The path to the file to write to'),
    content: z.string().describe('The content to write to the file'),
  }),
  execute: async ({ file_path, content }) => {
    fs.writeFileSync(file_path, content);
    return {
      file_path,
      content,
    };
  },
});

registerTool('FileExists', {
  description: 'Check if a file exists.',
  parameters: z.object({
    file_path: z.string().describe('The path to the file to check'),
  }),
  execute: async ({ file_path }) => ({
    file_path,
    exists: fs.existsSync(file_path),
  }),
});

registerTool('DirectoryList', {
  description: 'List all files in a directory.',
  parameters: z.object({
    directory_path: z.string().describe('The path to the directory to list'),
  }),
  execute: async ({ directory_path }) => ({
    directory_path,
    files: fs.readdirSync(directory_path)
  }),
});

registerTool('ShellExecute', {
  description: 'Execute a shell command.',
  parameters: z.object({
    command: z.string().describe('The command to execute'),
  }),
  execute: async ({ command }) => ({
    command,
    output: execSync(command, { encoding: 'utf8' }),
  }),
});

registerTool('Grep', {
  description: 'Grep a file or directory.',
  parameters: z.object({
    file_path: z.string().describe('The path to the file to grep'),
    pattern: z.string().describe('The pattern to grep'),    
  }),
  execute: async ({ file_path, pattern }) => ({
    file_path,
    pattern,
    content: fs.readFileSync(file_path, 'utf8').split('\n').filter(line => line.includes(pattern)).join('\n'),
  }),
});

