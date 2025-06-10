/**
 * Environment variable utilities for validation and debugging
 */

export interface EnvConfig {
  openrouter: {
    apiKey?: string;
    baseUrl?: string;
    httpReferer?: string;
    appName?: string;
  };
  models: {
    agent?: string;
    browser?: string;
    browserPlan?: string;
    write?: string;
    generateDoc?: string;
  };
  apis: {
    serper?: string;
    firecrawl?: string;
    alphaVantage?: string;
    mureka?: string;
    googleMaps?: string;
  };
  redis: {
    host?: string;
    auth?: string;
    db?: string;
  };
}

/**
 * Get all environment configuration in a structured format
 */
export function getEnvConfig(): EnvConfig {
  return {
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.OR_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL,
      httpReferer: process.env.OPENROUTER_HTTP_REFERER,
      appName: process.env.OPENROUTER_APP_NAME,
    },
    models: {
      agent: process.env.AGENT_LLM_MODEL,
      browser: process.env.BROWSER_LLM_MODEL,
      browserPlan: process.env.BROWSER_PLAN_MODEL,
      write: process.env.WRITE_AGENT_MODEL,
      generateDoc: process.env.GENERATE_DOC_MODEL,
    },
    apis: {
      serper: process.env.SERPER_API_KEY,
      firecrawl: process.env.FIRECRAWL_API_KEY,
      alphaVantage: process.env.ALPHA_VANTAGE_API_KEY,
      mureka: process.env.MUREKA_API_KEY,
      googleMaps: process.env.GOOGLE_MAPS_API_KEY,
    },
    redis: {
      host: process.env.REDIS_HOST,
      auth: process.env.REDIS_AUTH,
      db: process.env.REDIS_DB,
    },
  };
}

/**
 * Validate required environment variables
 */
export function validateEnv(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = getEnvConfig();

  // Check for OpenRouter API key
  if (!config.openrouter.apiKey) {
    errors.push('Missing OpenRouter API key. Set OPENROUTER_API_KEY, OPENAI_API_KEY, or OR_API_KEY');
  }

  // Validate API key format
  if (config.openrouter.apiKey && !config.openrouter.apiKey.startsWith('sk-')) {
    errors.push('Invalid API key format. OpenRouter keys should start with "sk-"');
  }

  // Check for other critical APIs if they're being used
  const criticalEnvVars = [
    { key: 'SERPER_API_KEY', value: config.apis.serper, description: 'Serper API key for search functionality' },
    { key: 'REDIS_HOST', value: config.redis.host, description: 'Redis host for caching' },
  ];

  criticalEnvVars.forEach(({ key, value, description }) => {
    if (!value) {
      errors.push(`Missing ${key}: ${description}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Log environment configuration (without sensitive data)
 */
export function logEnvStatus(): void {
  const config = getEnvConfig();
  
  console.log('🔧 Environment Configuration Status:');
  console.log(`  OpenRouter API Key: ${config.openrouter.apiKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  OpenRouter Base URL: ${config.openrouter.baseUrl || 'https://openrouter.ai/api/v1 (default)'}`);
  console.log(`  Agent Model: ${config.models.agent || '❌ Not set'}`);
  console.log(`  Browser Model: ${config.models.browser || '❌ Not set'}`);
  console.log(`  Serper API: ${config.apis.serper ? '✅ Set' : '❌ Missing'}`);
  console.log(`  Redis Host: ${config.redis.host || '❌ Not set'}`);
  
  const validation = validateEnv();
  if (!validation.isValid) {
    console.log('\n⚠️  Environment Issues:');
    validation.errors.forEach(error => console.log(`  - ${error}`));
  } else {
    console.log('\n✅ All critical environment variables are configured');
  }
}

/**
 * Mask sensitive values for logging
 */
export function maskSensitiveValue(value: string | undefined, visibleChars: number = 4): string {
  if (!value) return 'Not set';
  if (value.length <= visibleChars * 2) return '*'.repeat(value.length);
  
  const start = value.substring(0, visibleChars);
  const end = value.substring(value.length - visibleChars);
  const middle = '*'.repeat(Math.max(0, value.length - visibleChars * 2));
  
  return `${start}${middle}${end}`;
}