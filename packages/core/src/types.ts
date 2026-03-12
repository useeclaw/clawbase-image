// Core Intent Types

export type IntentType =
  | 'product-photo'
  | 'hero-banner'
  | 'avatar'
  | 'illustration'
  | 'icon'
  | 'social-media'
  | 'presentation'
  | 'custom';

export type StylePreset =
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

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export type ImageFormat = 'png' | 'jpg' | 'webp';

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '9:16' | string;
}

export interface IntentMetadata {
  brandColors?: string[];
  targetAudience?: string;
  mood?: string;
  lighting?: string;
  background?: string;
}

export interface ImageIntent {
  type: IntentType;
  subject: string;
  style?: StylePreset;
  quality?: QualityLevel;
  dimensions?: ImageDimensions;
  provider?: ProviderPreference;
  metadata?: IntentMetadata;
}

export interface ProviderPreference {
  name?: string;
  model?: string;
  priority?: number;
}

// Provider Types

export interface ProviderCapabilities {
  maxDimensions: ImageDimensions;
  supportedFormats: ImageFormat[];
  supportsBatch: boolean;
  supportsEditing: boolean;
  maxBatchSize: number;
}

export interface ProviderConfig {
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

export interface ProviderResult {
  url: string;
  localPath?: string;
  metadata: {
    provider: string;
    model: string;
    cost: number;
    latency: number;
    promptTokens?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface HealthStatus {
  healthy: boolean;
  latency?: number;
  message?: string;
}

export interface ImageProvider {
  readonly name: string;
  readonly supportedIntents: IntentType[];
  readonly capabilities: ProviderCapabilities;

  generate(config: ProviderConfig): Promise<ProviderResult>;
  validateConfig(config: ProviderConfig): ValidationResult;
  estimateCost(config: ProviderConfig): Promise<number>;
  initialize(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}

// Routing Types

export interface ProviderMetrics {
  name: string;
  successRate: number;
  avgLatency: number;
  costPer1K: number;
  qualityScore: number;
  available: boolean;
  supportedIntents: string[];
}

export interface ProviderScore {
  provider: string;
  score: number;
  breakdown: {
    successRate: number;
    latency: number;
    cost: number;
    quality: number;
    availability: number;
  };
}

export interface RoutingStrategy {
  type: 'smart' | 'cost-optimized' | 'quality-first' | 'manual';
  preferredProvider?: string;
  fallbackEnabled: boolean;
  maxRetries: number;
  budgetLimit?: {
    daily: number;
    monthly: number;
  };
  qualityThreshold?: number;
}

// Cache Types

export interface CacheConfig {
  type: 'memory' | 'redis' | 'filesystem';
  ttl: {
    url: number;
    image: number;
  };
  maxSize: number;
  maxEntries: number;
}

export interface CacheMetadata {
  provider: string;
  model: string;
  cost: number;
  hitCount: number;
}

export interface CacheEntry {
  key: string;
  url: string;
  localPath?: string;
  metadata: CacheMetadata;
  createdAt: number;
  expiresAt: number;
}

// Error Types

export interface ErrorOptions {
  code: string;
  message: string;
  suggestion: string;
  fix?: () => Promise<void>;
  originalError?: Error;
}

// Config Types

export interface ClawBaseConfig {
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

export interface RoutingConfig {
  strategy: RoutingStrategy['type'];
  providerPriority?: Record<string, string[]>;
}

export interface BudgetConfig {
  daily: number;
  monthly: number;
}

// Result Types

export interface GenerationResult {
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

export interface SkillResult {
  success: boolean;
  data?: unknown;
  message: string;
}
