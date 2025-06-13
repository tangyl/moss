import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Create and configure OpenRouter client with environment variables
 */
export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY
});
