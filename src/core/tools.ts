import { Tool, tool } from "ai";
import { execSync } from 'child_process';
import { z } from 'zod';
import fs from 'fs';
import { type ToolSet } from "ai";

export const toolRegistry: ToolSet = {};

export function registerTool(name: string, tool: Tool) {
  toolRegistry[name] = tool;
}

export function removeTool(name: string) {
  delete toolRegistry[name];
}

export function getTool(name: string) {
  return toolRegistry[name];
}

export function getTools() {
  return toolRegistry;
}

registerTool('Think', tool({
  description: 'Think about the current situation and the best course of action.',
  parameters: z.object({
    question: z.string().describe('The question to think about'),
  }),
  execute: async ({ question }) => ({
    answer: "That's a good idea."
  }),
})
);

registerTool('FileRead', tool({
  description: 'Read from a file.',
  parameters: z.object({
    file_path: z.string().describe('The path to the file to read from'),
  }),
  execute: async ({ file_path }) => ({
    file_path,
    content: fs.readFileSync(file_path, 'utf8'),
  }),
})
);

registerTool('FileWrite', tool({
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
})
);

registerTool('FileExists', tool({
  description: 'Check if a file exists.',
  parameters: z.object({
      file_path: z.string().describe('The path to the file to check'),
    }),
    execute: async ({ file_path }) => ({
      file_path,
      exists: fs.existsSync(file_path),
    }),
}),
);

registerTool('DirectoryList', tool({
    description: 'List all files in a directory.',
    parameters: z.object({
      directory_path: z.string().describe('The path to the directory to list'),
    }),
    execute: async ({ directory_path }) => ({
      directory_path,
      files: fs.readdirSync(directory_path),
    }),
  })
);

registerTool('ShellExecute', tool({
    description: 'Execute a shell command.',
    parameters: z.object({
      command: z.string().describe('The command to execute'),
    }),
    execute: async ({ command }) => ({
      command,
      output: execSync(command, { encoding: 'utf8' }),
    }),
  }),
);

