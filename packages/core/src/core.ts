import type {
  ClawBaseConfig,
  ImageIntent,
  GenerationResult,
  ImageProvider,
  RoutingStrategy,
  RetryPolicy,
  CacheConfig,
} from './types.js';
import { IntentParser } from './intent/parser.js';
import { ProviderRouter } from './router/index.js';
import { CacheManager } from './cache/manager.js';
import { AgentFriendlyError, ErrorCodes, ErrorMessages } from './errors/index.js';

// Default configuration
export const defaultConfig: ClawBaseConfig = {
  core: {
    defaultProvider: 'siliconflow',
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 30000,
  },
  providers: {},
  cache: {
    type: 'memory',
    ttl: {
      url: 3600, // 1 hour
      image: 86400, // 24 hours
    },
    maxSize: 100,
    maxEntries: 1000,
  },
  routing: {
    strategy: 'smart',
  },
  budget: {
    daily: 100,
    monthly: 2000,
  },
  monitoring: {
    enabled: true,
    logLevel: 'info',
  },
};

export class ClawBaseCore {
  private config: ClawBaseConfig;
  private intentParser: IntentParser;
  private router: ProviderRouter;
  private cache: CacheManager;
  private providers: Map<string, ImageProvider> = new Map();
  private retryPolicy: RetryPolicy;

  constructor(config: Partial<ClawBaseConfig> = {}) {
    this.config = this.mergeConfig(defaultConfig, config);
    this.intentParser = new IntentParser();
    this.router = new ProviderRouter({
      type: this.config.routing.strategy,
      fallbackEnabled: this.config.core.fallbackEnabled,
      maxRetries: this.config.core.maxRetries,
    });
    this.cache = new CacheManager(this.config.cache);
    this.retryPolicy = {
      maxRetries: this.config.core.maxRetries,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000,
      retryableErrors: ['TIMEOUT', 'PROVIDER_ERROR', 'PROVIDER_UNAVAILABLE'],
    };
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(defaults: ClawBaseConfig, user: Partial<ClawBaseConfig>): ClawBaseConfig {
    return {
      core: { ...defaults.core, ...user.core },
      providers: { ...defaults.providers, ...user.providers },
      cache: { ...defaults.cache, ...user.cache },
      routing: { ...defaults.routing, ...user.routing },
      budget: { ...defaults.budget, ...user.budget },
      monitoring: { ...defaults.monitoring, ...user.monitoring },
    };
  }

  /**
   * Register a provider
   */
  registerProvider(provider: ImageProvider): void {
    this.providers.set(provider.name, provider);
    this.router.registerProvider({
      name: provider.name,
      successRate: 1.0,
      avgLatency: 1000,
      costPer1K: 1.0,
      qualityScore: 0.9,
      available: true,
      supportedIntents: provider.supportedIntents,
    });
  }

  /**
   * Generate image from intent
   */
  async generate(intent: ImageIntent): Promise<GenerationResult> {
    // Check cache first
    const cacheKey = CacheManager.generateKey(intent);
    const cached = await this.cache.get(cacheKey);

    if (cached) {
      return {
        url: cached.url,
        localPath: cached.localPath,
        metadata: {
          provider: cached.metadata.provider,
          model: cached.metadata.model,
          cost: 0, // Cached result is free
          latency: 0,
          intent,
        },
      };
    }

    // Select provider
    const providerName = this.router.selectProvider(intent);
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new AgentFriendlyError({
        code: ErrorCodes.NO_SUPPORTED_PROVIDER,
        message: `Provider ${providerName} is not registered`,
        suggestion: 'Register a provider or check your configuration',
      });
    }

    // Build prompt and params
    const prompt = this.intentParser.buildPrompt(intent);
    const params = this.intentParser.getGenerationParams(intent);

    // Prepare provider config
    const providerConfig = {
      prompt,
      dimensions: params.dimensions,
      format: 'png' as const,
      model: intent.provider?.model,
      steps: params.steps,
      cfg: params.cfg,
    };

    // Validate config
    const validation = provider.validateConfig(providerConfig);
    if (!validation.valid) {
      throw new AgentFriendlyError({
        code: ErrorCodes.INVALID_CONFIG,
        message: `Invalid provider configuration: ${validation.errors?.join(', ')}`,
        suggestion: 'Check your intent parameters',
      });
    }

    // Generate with retry
    const startTime = Date.now();
    const result = await this.router.executeWithRetry(
      () => provider.generate(providerConfig),
      this.retryPolicy,
      providerName
    );

    const latency = Date.now() - startTime;

    // Cache result
    await this.cache.set(cacheKey, result.url, {
      provider: result.metadata.provider,
      model: result.metadata.model,
      cost: result.metadata.cost,
    });

    return {
      url: result.url,
      localPath: result.localPath,
      metadata: {
        provider: result.metadata.provider,
        model: result.metadata.model,
        cost: result.metadata.cost,
        latency,
        intent,
      },
    };
  }

  /**
   * Generate from text description
   */
  async generateFromText(description: string): Promise<GenerationResult> {
    const intent = this.intentParser.parse(description);
    return this.generate(intent);
  }

  /**
   * Get available providers
   */
  getProviders(): Array<{ name: string; supportedIntents: string[]; available: boolean }> {
    return Array.from(this.providers.values()).map(p => ({
      name: p.name,
      supportedIntents: p.supportedIntents,
      available: true,
    }));
  }

  /**
   * Get provider status
   */
  async getProviderStatus(providerName: string): Promise<{
    name: string;
    available: boolean;
    circuitBreakerState: string;
  }> {
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new AgentFriendlyError({
        code: ErrorCodes.NO_SUPPORTED_PROVIDER,
        message: `Provider ${providerName} not found`,
        suggestion: 'Check available providers with getProviders()',
      });
    }

    const health = await provider.healthCheck();

    return {
      name: providerName,
      available: health.healthy,
      circuitBreakerState: this.router.getCircuitBreakerState(providerName),
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ReturnType<CacheManager['getStats']> {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
  }
}

// Export types
export * from './types.js';
export { AgentFriendlyError, ErrorCodes, ErrorMessages } from './errors/index.js';
export { IntentParser } from './intent/parser.js';
export { ProviderRouter, CircuitBreaker } from './router/index.js';
export { CacheManager } from './cache/manager.js';
