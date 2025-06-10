import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Get OpenRouter API key from environment variables
 * Supports multiple environment variable names for flexibility
 */
function getOpenRouterApiKey(): string {
  // Try multiple possible environment variable names
  const apiKey = process.env.OPENROUTER_API_KEY || 
                 process.env.OPENAI_API_KEY || // Fallback if using OpenRouter through OpenAI interface
                 process.env.OR_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not found. Please set one of the following environment variables:\n' +
      '- OPENROUTER_API_KEY\n' +
      '- OPENAI_API_KEY (if using OpenRouter through OpenAI interface)\n' +
      '- OR_API_KEY'
    );
  }

  // Basic validation - OpenRouter keys typically start with 'sk-or-v1-'
  if (!apiKey.startsWith('sk-or-v1-') && !apiKey.startsWith('sk-')) {
    console.warn('Warning: API key format may be incorrect for OpenRouter');
  }

  return apiKey;
}

/**
 * Get OpenRouter base URL from environment variables
 * Defaults to OpenRouter's official API endpoint
 */
function getOpenRouterBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL || 
         process.env.OPENAI_BASE_URL || 
         'https://openrouter.ai/api/v1';
}

/**
 * Create and configure OpenRouter client with environment variables
 */
export const openrouter = createOpenRouter({
  apiKey: getOpenRouterApiKey(),
  headers: {
    'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || undefined,
    'X-Title': process.env.OPENROUTER_APP_NAME || undefined,
  },
});

// Export configuration for debugging/logging (without sensitive data)
export const openrouterConfig = {
  baseURL: getOpenRouterBaseUrl(),
  hasApiKey: !!process.env.OPENROUTER_API_KEY || !!process.env.OPENAI_API_KEY || !!process.env.OR_API_KEY,
  httpReferer: process.env.OPENROUTER_HTTP_REFERER,
  appName: process.env.OPENROUTER_APP_NAME,
};