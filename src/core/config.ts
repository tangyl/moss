import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { ConfigLock } from './config-lock';

export interface MossConfig {
  configDir: string;
  provider: string;
  apiKey: string;
  model: string;
  sysPrompt: string;
}

// Global lock instance
let globalConfigLock: ConfigLock | null = null;

export function findMossConfigDir(): string {
  // First search upwards from current directory
  let currentDir = process.cwd();
  while (currentDir !== path.parse(currentDir).root) {
    const mossDir = path.join(currentDir, '.moss');
    if (fs.existsSync(mossDir)) {
      return mossDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // If not found in current or parent directories, check $HOME/.moss
  const homeMossDir = path.join(os.homedir(), '.moss');
  if (fs.existsSync(homeMossDir)) {
    return homeMossDir;
  }

  // If no .moss directory found anywhere, create one in current directory
  const newMossDir = path.join(process.cwd(), '.moss');
  fs.mkdirSync(newMossDir, { recursive: true });
  return newMossDir;
}

export function getConfig(): MossConfig {
  const configDir = findMossConfigDir();
  const configPath = path.join(configDir, 'config.yml');
  
  let config: Partial<MossConfig> = {
    configDir,
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
  };

  try {
    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf8');
      const yamlConfig = yaml.load(configContent) as Partial<MossConfig>;
      config = { ...config, ...yamlConfig };
    }
  } catch (error) {
    console.error('Error reading config file:', error);
  }

  // get api key from environment variable
  config.apiKey = config.apiKey || process.env['OPENROUTER_API_KEY'] || '';

  if (!config.apiKey) {
    throw new Error('API key not found. Please set OPENROUTER_API_KEY environment variable or add it to config.yml');
  }

  return config as MossConfig;
}

/**
 * Get configuration with automatic locking
 * @param timeout Lock timeout in milliseconds
 * @returns Promise<MossConfig>
 */
export async function getConfigWithLock(timeout: number = 5000): Promise<MossConfig> {
  const config = getConfig();
  
  // Create lock instance
  if (!globalConfigLock) {
    globalConfigLock = new ConfigLock(config.configDir);
  }
  
  // Try to acquire lock
  await globalConfigLock.acquireLock(timeout);
  
  return config;
}

/**
 * Release configuration lock
 */
export async function releaseConfigLock(): Promise<void> {
  if (globalConfigLock) {
    await globalConfigLock.releaseLock();
    globalConfigLock = null;
  }
}

/**
 * Get current lock information
 */
export async function getLockInfo(): Promise<any | null> {
  const config = getConfig();
  const lock = new ConfigLock(config.configDir);
  return await lock.getLockInfo();
}

/**
 * Force clear lock file (for debugging or emergency situations)
 */
export async function forceClearLock(): Promise<void> {
  const config = getConfig();
  const lock = new ConfigLock(config.configDir);
  try {
    await lock.releaseLock();
  } catch (error) {
    // Silently handle errors
  }
}
