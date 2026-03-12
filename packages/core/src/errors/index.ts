import type { ErrorOptions } from '../types.js';

export class AgentFriendlyError extends Error {
  code: string;
  suggestion: string;
  fix?: () => Promise<void>;
  originalError?: Error;

  constructor(options: ErrorOptions) {
    super(options.message);
    this.name = 'AgentFriendlyError';
    this.code = options.code;
    this.suggestion = options.suggestion;
    this.fix = options.fix;
    this.originalError = options.originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AgentFriendlyError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
      hasFix: !!this.fix,
    };
  }
}

// Error codes
export const ErrorCodes = {
  // Provider errors
  PROVIDER_RATE_LIMIT: 'PROVIDER_RATE_LIMIT',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  NO_SUPPORTED_PROVIDER: 'NO_SUPPORTED_PROVIDER',

  // Configuration errors
  INVALID_INTENT: 'INVALID_INTENT',
  INVALID_DIMENSIONS: 'INVALID_DIMENSIONS',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // Content errors
  PROMPT_REJECTED: 'PROMPT_REJECTED',
  UNSAFE_CONTENT: 'UNSAFE_CONTENT',

  // System errors
  CACHE_ERROR: 'CACHE_ERROR',
  TIMEOUT: 'TIMEOUT',
  MAX_RETRIES_EXCEEDED: 'MAX_RETRIES_EXCEEDED',
} as const;

// Error code messages
export const ErrorMessages: Record<string, string> = {
  [ErrorCodes.PROVIDER_RATE_LIMIT]: 'Provider rate limit exceeded',
  [ErrorCodes.PROVIDER_UNAVAILABLE]: 'Provider is currently unavailable',
  [ErrorCodes.PROVIDER_ERROR]: 'Provider returned an error',
  [ErrorCodes.NO_SUPPORTED_PROVIDER]: 'No provider supports the requested intent type',
  [ErrorCodes.INVALID_INTENT]: 'Invalid intent type',
  [ErrorCodes.INVALID_DIMENSIONS]: 'Invalid image dimensions',
  [ErrorCodes.MISSING_API_KEY]: 'API key is required',
  [ErrorCodes.INVALID_CONFIG]: 'Invalid configuration',
  [ErrorCodes.PROMPT_REJECTED]: 'Prompt was rejected by content filter',
  [ErrorCodes.UNSAFE_CONTENT]: 'Generated content was flagged as unsafe',
  [ErrorCodes.CACHE_ERROR]: 'Cache operation failed',
  [ErrorCodes.TIMEOUT]: 'Request timed out',
  [ErrorCodes.MAX_RETRIES_EXCEEDED]: 'Maximum retry attempts exceeded',
};

// Helper function to convert provider errors
export function convertProviderError(error: unknown, provider: string): AgentFriendlyError {
  const err = error as { code?: number | string; message?: string; status?: number };

  // SiliconFlow specific errors
  if (provider === 'siliconflow') {
    const code = err.code || err.status;

    if (code === 429 || code === 'RATE_LIMIT') {
      return new AgentFriendlyError({
        code: ErrorCodes.PROVIDER_RATE_LIMIT,
        message: 'SiliconFlow rate limit exceeded',
        suggestion: 'Wait 60 seconds or switch to another provider',
        fix: async () => {
          await new Promise(resolve => setTimeout(resolve, 60000));
        },
        originalError: error instanceof Error ? error : undefined,
      });
    }

    if (code === 400) {
      if (err.message?.includes('prompt') || err.message?.includes('content')) {
        return new AgentFriendlyError({
          code: ErrorCodes.PROMPT_REJECTED,
          message: 'The prompt was rejected by content filter',
          suggestion: 'Try rephrasing your description without sensitive content',
          originalError: error instanceof Error ? error : undefined,
        });
      }
    }

    if (code === 401) {
      return new AgentFriendlyError({
        code: ErrorCodes.MISSING_API_KEY,
        message: 'Invalid or missing SiliconFlow API key',
        suggestion: 'Check your SILICONFLOW_API_KEY environment variable',
        originalError: error instanceof Error ? error : undefined,
      });
    }

    if (code === 500 || code === 502 || code === 503) {
      return new AgentFriendlyError({
        code: ErrorCodes.PROVIDER_UNAVAILABLE,
        message: 'SiliconFlow service is temporarily unavailable',
        suggestion: 'Try again later or use a different provider',
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  // Generic error conversion
  return new AgentFriendlyError({
    code: ErrorCodes.PROVIDER_ERROR,
    message: `${provider} error: ${err.message || 'Unknown error'}`,
    suggestion: 'Try again or use a different provider',
    originalError: error instanceof Error ? error : undefined,
  });
}

// Helper function for sleep
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
