import type {
  ProviderMetrics,
  ProviderScore,
  ImageIntent,
  RoutingStrategy,
} from '../types.js';
import { AgentFriendlyError, ErrorCodes, ErrorMessages } from '../errors/index.js';

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly timeout: number;

  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
    }
  }

  canExecute(): boolean {
    if (this.state === 'closed') return true;

    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.timeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    return true; // half-open
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export class ProviderRouter {
  private providers: Map<string, ProviderMetrics> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private strategy: RoutingStrategy;

  constructor(strategy: RoutingStrategy) {
    this.strategy = strategy;
  }

  /**
   * Register a provider
   */
  registerProvider(metrics: ProviderMetrics): void {
    this.providers.set(metrics.name, metrics);
    if (!this.circuitBreakers.has(metrics.name)) {
      this.circuitBreakers.set(metrics.name, new CircuitBreaker());
    }
  }

  /**
   * Update provider metrics
   */
  updateMetrics(name: string, metrics: Partial<ProviderMetrics>): void {
    const existing = this.providers.get(name);
    if (existing) {
      this.providers.set(name, { ...existing, ...metrics });
    }
  }

  /**
   * Get provider metrics
   */
  getProvider(name: string): ProviderMetrics | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): ProviderMetrics[] {
    return Array.from(this.providers.values()).filter(p => {
      const cb = this.circuitBreakers.get(p.name);
      return p.available && (cb?.canExecute() ?? true);
    });
  }

  /**
   * Select best provider for intent
   */
  selectProvider(intent: ImageIntent): string {
    // Get available providers that support this intent
    const candidates = this.getAvailableProviders().filter(p =>
      p.supportedIntents.includes(intent.type)
    );

    if (candidates.length === 0) {
      throw new AgentFriendlyError({
        code: ErrorCodes.NO_SUPPORTED_PROVIDER,
        message: ErrorMessages[ErrorCodes.NO_SUPPORTED_PROVIDER],
        suggestion: 'Try a different intent type or contact support',
      });
    }

    // Manual provider selection
    if (this.strategy.type === 'manual' && this.strategy.preferredProvider) {
      const provider = candidates.find(p => p.name === this.strategy.preferredProvider);
      if (provider) return provider.name;
    }

    // Calculate scores for all candidates
    const scored = candidates.map(p => this.calculateScore(p, intent));

    // Sort based on strategy
    switch (this.strategy.type) {
      case 'cost-optimized':
        scored.sort((a, b) => a.breakdown.cost - b.breakdown.cost);
        break;
      case 'quality-first':
        scored.sort((a, b) => b.breakdown.quality - a.breakdown.quality);
        break;
      case 'smart':
      default:
        scored.sort((a, b) => b.score - a.score);
    }

    // Return the best provider
    return scored[0].provider;
  }

  /**
   * Calculate provider score
   */
  calculateScore(metrics: ProviderMetrics, intent: ImageIntent): ProviderScore {
    const weights = {
      successRate: 0.30,
      latency: 0.25,
      cost: 0.25,
      quality: 0.15,
      availability: 0.05,
    };

    // Normalize metrics
    const normalizedLatency = Math.max(0, 1 - metrics.avgLatency / 5000);
    const normalizedCost = Math.max(0, 1 - metrics.costPer1K / 10);

    // Calculate weighted score
    const score =
      metrics.successRate * weights.successRate +
      normalizedLatency * weights.latency +
      normalizedCost * weights.cost +
      metrics.qualityScore * weights.quality +
      (metrics.available ? 1 : 0) * weights.availability;

    return {
      provider: metrics.name,
      score,
      breakdown: {
        successRate: metrics.successRate * weights.successRate,
        latency: normalizedLatency * weights.latency,
        cost: normalizedCost * weights.cost,
        quality: metrics.qualityScore * weights.quality,
        availability: (metrics.available ? 1 : 0) * weights.availability,
      },
    };
  }

  /**
   * Record successful call
   */
  recordSuccess(providerName: string): void {
    const cb = this.circuitBreakers.get(providerName);
    if (cb) {
      cb.recordSuccess();
    }

    // Update success rate
    const metrics = this.providers.get(providerName);
    if (metrics) {
      // Simple moving average for success rate
      metrics.successRate = metrics.successRate * 0.9 + 0.1;
      this.providers.set(providerName, metrics);
    }
  }

  /**
   * Record failed call
   */
  recordFailure(providerName: string): void {
    const cb = this.circuitBreakers.get(providerName);
    if (cb) {
      cb.recordFailure();
    }

    // Update success rate
    const metrics = this.providers.get(providerName);
    if (metrics) {
      metrics.successRate = metrics.successRate * 0.9;
      this.providers.set(providerName, metrics);
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(providerName: string): string {
    const cb = this.circuitBreakers.get(providerName);
    return cb?.getState() ?? 'closed';
  }

  /**
   * Execute with retry
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policy: RetryPolicy,
    provider: string
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        const result = await operation();
        this.recordSuccess(provider);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(provider);

        if (attempt < policy.maxRetries) {
          const delay = this.calculateBackoff(attempt, policy);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new AgentFriendlyError({
      code: ErrorCodes.MAX_RETRIES_EXCEEDED,
      message: `Failed after ${policy.maxRetries} retries`,
      suggestion: 'Try again later or use a different provider',
      originalError: lastError,
    });
  }

  /**
   * Calculate backoff delay
   */
  private calculateBackoff(attempt: number, policy: RetryPolicy): number {
    let delay: number;

    switch (policy.backoffStrategy) {
      case 'exponential':
        delay = policy.initialDelay * Math.pow(2, attempt);
        break;
      case 'linear':
        delay = policy.initialDelay * (attempt + 1);
        break;
      case 'fixed':
      default:
        delay = policy.initialDelay;
    }

    // Add jitter
    const jitter = Math.random() * 100;
    return Math.min(delay + jitter, policy.maxDelay);
  }
}
