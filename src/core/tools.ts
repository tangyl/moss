import { tool } from "ai";
import { execSync } from 'child_process';
import { z } from 'zod';
import fs from 'fs';

export const tools = {
  'fs_read': tool({
    description: 'Read from a file.',
    parameters: z.object({
      file_path: z.string().describe('The path to the file to read from'),
    }),
    execute: async ({ file_path }) => ({
      file_path,
      content: fs.readFileSync(file_path, 'utf8'),
    }),
  }),
  'fs_write': tool({
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
  }),
  'fs_exists': tool({
    description: 'Check if a file exists.',
    parameters: z.object({
      file_path: z.string().describe('The path to the file to check'),
    }),
    execute: async ({ file_path }) => ({
      file_path,
      exists: fs.existsSync(file_path),
    }),
  }),
  'fs_listdir': tool({
    description: 'List all files in a directory.',
    parameters: z.object({
      directory_path: z.string().describe('The path to the directory to list'),
    }),
    execute: async ({ directory_path }) => ({
      directory_path,
      files: fs.readdirSync(directory_path),
    }),
  }),
  'os_shell_exec': tool({
    description: 'Execute a shell command.',
    parameters: z.object({
      command: z.string().describe('The command to execute'),
    }),
    execute: async ({ command }) => ({
      command,
      output: execSync(command, { encoding: 'utf8' }),
    }),
  }),
}