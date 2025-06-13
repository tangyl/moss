import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as yaml from 'js-yaml';

export interface MossConfig {
  configDir: string;
  provider: string;
  apiKey: string;
  model: string;
  sysPrompt: string;
}

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
