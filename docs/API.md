# ClawBase Image API Documentation

## Table of Contents

- [Core SDK](#core-sdk)
  - [ClawBaseCore](#clawbasecore)
  - [IntentParser](#intentparser)
  - [ProviderRouter](#providerrouter)
  - [CircuitBreaker](#circuitbreaker)
  - [CacheManager](#cachemanager)
  - [AgentFriendlyError](#agentfriendlyerror)
- [SiliconFlow Adapter](#siliconflow-adapter)
  - [SiliconFlowProvider](#siliconflowprovider)
- [Types](#types)

---

## Core SDK

### ClawBaseCore

Main SDK class for image generation.

#### Constructor

```typescript
constructor(config?: Partial<ClawBaseConfig>)
```

#### Methods

##### `registerProvider(provider: ImageProvider): void`

Register a provider with the SDK.

```typescript
const siliconflow = new SiliconFlowProvider({ apiKey: '...' });
clawbase.registerProvider(siliconflow);
```

##### `generate(intent: ImageIntent): Promise<GenerationResult>`

Generate an image from an ImageIntent.

```typescript
const intent: ImageIntent = {
  type: 'product-photo',
  subject: 'wireless earbuds',
  style: 'minimal-white-background',
  quality: 'high',
};

const result = await clawbase.generate(intent);
```

**Returns:**

```typescript
interface GenerationResult {
  url: string;
  localPath?: string;
  metadata: {
    provider: string;
    model: string;
    cost: number;
    latency: number;
    intent: ImageIntent;
  };
}
```

##### `generateFromText(description: string): Promise<GenerationResult>`

Generate an image from a natural language description.

```typescript
const result = await clawbase.generateFromText(
  '生成一张无线耳机白底产品图，高清'
);
```

##### `getProviders(): Array<{ name: string; supportedIntents: string[]; available: boolean }>`

Get all registered providers.

```typescript
const providers = clawbase.getProviders();
```

##### `getProviderStatus(providerName: string): Promise<{ name: string; available: boolean; circuitBreakerState: string }>`

Get provider health status and circuit breaker state.

```typescript
const status = await clawbase.getProviderStatus('siliconflow');
```

##### `getCacheStats(): { size: number; maxEntries: number; hitRate: number }`

Get cache statistics.

```typescript
const stats = clawbase.getCacheStats();
```

##### `clearCache(): Promise<void>`

Clear all cache entries.

```typescript
await clawbase.clearCache();
```

---

### IntentParser

Parse natural language descriptions into ImageIntent objects.

#### Methods

##### `parse(input: string): ImageIntent`

Parse a natural language request into an ImageIntent.

```typescript
const parser = new IntentParser();
const intent = parser.parse('生成一张无线耳机产品图，白色背景');
// Returns: { type: 'product-photo', subject: 'wireless earbuds', style: 'minimal-white-background', quality: 'medium' }
```

##### `buildPrompt(intent: ImageIntent): string`

Build a full prompt from an intent.

```typescript
const prompt = parser.buildPrompt(intent);
```

##### `getGenerationParams(intent: ImageIntent): { dimensions: ImageDimensions; steps: number; cfg: number }`

Get generation parameters for an intent.

```typescript
const params = parser.getGenerationParams(intent);
// Returns: { dimensions: { width: 1024, height: 1024 }, steps: 30, cfg: 7.5 }
```

---

### ProviderRouter

Routes requests to the best available provider.

#### Constructor

```typescript
constructor(strategy: RoutingStrategy)
```

#### Methods

##### `registerProvider(metrics: ProviderMetrics): void`

Register a provider with the router.

```typescript
router.registerProvider({
  name: 'siliconflow',
  successRate: 0.95,
  avgLatency: 2000,
  costPer1K: 0.015,
  qualityScore: 0.9,
  available: true,
  supportedIntents: ['product-photo', 'avatar', 'illustration'],
});
```

##### `selectProvider(intent: ImageIntent): string`

Select the best provider for an intent.

```typescript
const providerName = router.selectProvider(intent);
```

##### `executeWithRetry<T>(operation: () => Promise<T>, policy: RetryPolicy, provider: string): Promise<T>`

Execute an operation with retry logic.

```typescript
const result = await router.executeWithRetry(
  () => provider.generate(config),
  { maxRetries: 3, backoffStrategy: 'exponential', initialDelay: 1000, maxDelay: 30000, retryableErrors: ['TIMEOUT'] },
  'siliconflow'
);
```

##### `getCircuitBreakerState(providerName: string): string`

Get the circuit breaker state for a provider.

```typescript
const state = router.getCircuitBreakerState('siliconflow');
// Returns: 'closed' | 'open' | 'half-open'
```

---

### CircuitBreaker

Prevents cascading failures by opening when errors exceed threshold.

#### Constructor

```typescript
constructor(threshold?: number, timeout?: number)
```

- `threshold`: Number of failures before opening (default: 5)
- `timeout`: Time in milliseconds before attempting reset (default: 60000)

#### Methods

##### `canExecute(): boolean`

Check if operations should be allowed.

```typescript
if (circuitBreaker.canExecute()) {
  // Execute operation
}
```

##### `recordSuccess(): void`

Record a successful operation.

```typescript
circuitBreaker.recordSuccess();
```

##### `recordFailure(): void`

Record a failed operation.

```typescript
circuitBreaker.recordFailure();
```

##### `getState(): string`

Get current state ('closed' | 'open' | 'half-open').

```typescript
const state = circuitBreaker.getState();
```

##### `getFailureCount(): number`

Get current failure count.

```typescript
const count = circuitBreaker.getFailureCount();
```

---

### CacheManager

In-memory cache for generated images.

#### Constructor

```typescript
constructor(config: CacheConfig)
```

#### Static Methods

##### `generateKey(intent: ImageIntent): string`

Generate a cache key from an intent.

```typescript
const key = CacheManager.generateKey(intent);
```

#### Methods

##### `get(key: string): Promise<CacheEntry | null>`

Get a cache entry by key.

```typescript
const entry = await cache.get(key);
```

##### `set(key: string, url: string, metadata: CacheMetadata): Promise<void>`

Set a cache entry.

```typescript
await cache.set(key, 'https://...', { provider: 'siliconflow', model: 'kolors', cost: 0.015 });
```

##### `delete(key: string): Promise<void>`

Delete a cache entry.

```typescript
await cache.delete(key);
```

##### `clear(): Promise<void>`

Clear all cache entries.

```typescript
await cache.clear();
```

##### `getStats(): { size: number; maxEntries: number; hitRate: number }`

Get cache statistics.

```typescript
const stats = cache.getStats();
```

---

### AgentFriendlyError

Error class with actionable suggestions for agents.

#### Constructor

```typescript
constructor(options: ErrorOptions)
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `string` | Error code |
| `message` | `string` | Human-readable message |
| `suggestion` | `string` | Actionable suggestion |
| `fix` | `() => Promise<void>` | Optional auto-fix function |
| `originalError` | `Error` | Original error if wrapped |

#### Methods

##### `toJSON(): Record<string, unknown>`

Serialize error to JSON.

```typescript
const json = error.toJSON();
```

#### Error Codes

| Code | Description |
|------|-------------|
| `PROVIDER_RATE_LIMIT` | Provider rate limit exceeded |
| `PROVIDER_UNAVAILABLE` | Provider is currently unavailable |
| `PROVIDER_ERROR` | Provider returned an error |
| `NO_SUPPORTED_PROVIDER` | No provider supports the requested intent |
| `INVALID_INTENT` | Invalid intent type |
| `INVALID_DIMENSIONS` | Invalid image dimensions |
| `MISSING_API_KEY` | API key is required |
| `INVALID_CONFIG` | Invalid configuration |
| `PROMPT_REJECTED` | Prompt was rejected by content filter |
| `UNSAFE_CONTENT` | Generated content was flagged as unsafe |
| `CACHE_ERROR` | Cache operation failed |
| `TIMEOUT` | Request timed out |
| `MAX_RETRIES_EXCEEDED` | Maximum retry attempts exceeded |

---

## SiliconFlow Adapter

### SiliconFlowProvider

SiliconFlow provider implementation.

#### Constructor

```typescript
constructor(options?: {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
})
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `'siliconflow'` | Provider name |
| `supportedIntents` | `IntentType[]` | Supported intent types |
| `capabilities` | `ProviderCapabilities` | Provider capabilities |

#### Methods

##### `initialize(): Promise<void>`

Initialize the provider (validates API key).

```typescript
await provider.initialize();
```

##### `generate(config: ProviderConfig): Promise<ProviderResult>`

Generate an image.

```typescript
const result = await provider.generate({
  prompt: 'product photography, wireless earbuds',
  dimensions: { width: 1024, height: 1024 },
  format: 'png',
  model: 'kolors',
});
```

##### `validateConfig(config: ProviderConfig): ValidationResult`

Validate configuration before generation.

```typescript
const validation = provider.validateConfig(config);
if (!validation.valid) {
  console.log(validation.errors);
}
```

##### `estimateCost(config: ProviderConfig): Promise<number>`

Estimate the cost of generation.

```typescript
const cost = await provider.estimateCost(config);
```

##### `healthCheck(): Promise<HealthStatus>`

Check provider health.

```typescript
const health = await provider.healthCheck();
```

---

## Types

### ImageIntent

```typescript
interface ImageIntent {
  type: IntentType;
  subject: string;
  style?: StylePreset;
  quality?: QualityLevel;
  dimensions?: ImageDimensions;
  provider?: ProviderPreference;
  metadata?: IntentMetadata;
}
```

### ProviderConfig

```typescript
interface ProviderConfig {
  prompt: string;
  negativePrompt?: string;
  dimensions: ImageDimensions;
  format: ImageFormat;
  model?: string;
  steps?: number;
  cfg?: number;
  seed?: number;
  apiKey?: string;
  baseUrl?: string;
}
```

### ClawBaseConfig

```typescript
interface ClawBaseConfig {
  core: {
    defaultProvider: string;
    fallbackEnabled: boolean;
    maxRetries: number;
    timeout: number;
  };
  providers: Record<string, ProviderConfig>;
  cache: CacheConfig;
  routing: RoutingConfig;
  budget: BudgetConfig;
  monitoring: {
    enabled: boolean;
    metricsEndpoint?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}
```

### RetryPolicy

```typescript
interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}
```

### RoutingStrategy

```typescript
interface RoutingStrategy {
  type: 'smart' | 'cost-optimized' | 'quality-first' | 'manual';
  preferredProvider?: string;
  fallbackEnabled: boolean;
  maxRetries: number;
  budgetLimit?: { daily: number; monthly: number };
  qualityThreshold?: number;
}
```

### CacheConfig

```typescript
interface CacheConfig {
  type: 'memory' | 'redis' | 'filesystem';
  ttl: {
    url: number;
    image: number;
  };
  maxSize: number;
  maxEntries: number;
}
```

---

## Type Aliases

```typescript
type IntentType =
  | 'product-photo'
  | 'hero-banner'
  | 'avatar'
  | 'illustration'
  | 'icon'
  | 'social-media'
  | 'presentation'
  | 'custom';

type StylePreset =
  | 'minimal-white-background'
  | 'studio-lighting'
  | 'lifestyle-outdoor'
  | 'flat-design'
  | '3d-render'
  | 'watercolor'
  | 'sketch'
  | 'photorealistic'
  | 'modern-tech'
  | 'vibrant'
  | 'professional'
  | 'casual'
  | string;

type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

type ImageFormat = 'png' | 'jpg' | 'webp';
```

---

## Examples

### Complete Workflow

```typescript
import { ClawBaseCore } from '@clawbase/core';
import { SiliconFlowProvider } from '@clawbase/adapter-siliconflow';
import { AgentFriendlyError } from '@clawbase/core';

async function main() {
  // Initialize
  const clawbase = new ClawBaseCore({
    core: { defaultProvider: 'siliconflow' },
  });

  // Register provider
  const provider = new SiliconFlowProvider({
    apiKey: process.env.SILICONFLOW_API_KEY,
  });
  clawbase.registerProvider(provider);

  try {
    // Generate image
    const result = await clawbase.generateFromText(
      '生成一张高清无线耳机白底产品图'
    );

    console.log('Image URL:', result.url);
    console.log('Cost:', result.metadata.cost);
    console.log('Latency:', result.metadata.latency);

    // Check provider status
    const status = await clawbase.getProviderStatus('siliconflow');
    console.log('Provider available:', status.available);

    // Get cache stats
    const stats = clawbase.getCacheStats();
    console.log('Cache hit rate:', stats.hitRate);

  } catch (error) {
    if (error instanceof AgentFriendlyError) {
      console.error('Error:', error.message);
      console.error('Suggestion:', error.suggestion);
    }
  }
}

main();
```
