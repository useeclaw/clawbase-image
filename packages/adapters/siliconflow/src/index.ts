import type {
  ImageProvider,
  ProviderConfig,
  ProviderResult,
  ValidationResult,
  HealthStatus,
  ProviderCapabilities,
  IntentType,
  ImageDimensions,
} from '@clawbase/core';
import { convertProviderError } from '@clawbase/core';

// SiliconFlow API types
interface SiliconFlowResponse {
  images: Array<{
    url: string;
    seed?: number;
  }>;
  timings?: {
    inference?: number;
  };
}

interface SiliconFlowRequest {
  model: string;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  scheduler?: string;
}

// Model configurations
const MODEL_CONFIGS: Record<string, { maxSize: number; supportedSizes: ImageDimensions[] }> = {
  kolors: {
    maxSize: 2048,
    supportedSizes: [
      { width: 512, height: 512 },
      { width: 768, height: 768 },
      { width: 1024, height: 1024 },
      { width: 1024, height: 1536 },
      { width: 1536, height: 1024 },
      { width: 2048, height: 2048 },
    ],
  },
  'stable-diffusion-xl': {
    maxSize: 1024,
    supportedSizes: [
      { width: 512, height: 512 },
      { width: 768, height: 768 },
      { width: 1024, height: 1024 },
    ],
  },
};

export class SiliconFlowProvider implements ImageProvider {
  readonly name = 'siliconflow';
  readonly supportedIntents: IntentType[] = [
    'product-photo',
    'avatar',
    'illustration',
    'icon',
    'social-media',
    'custom',
  ];

  readonly capabilities: ProviderCapabilities = {
    maxDimensions: { width: 2048, height: 2048 },
    supportedFormats: ['png', 'jpg'],
    supportsBatch: false,
    supportsEditing: false,
    maxBatchSize: 1,
  };

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(options: { apiKey?: string; baseUrl?: string; defaultModel?: string } = {}) {
    this.apiKey = options.apiKey || process.env.SILICONFLOW_API_KEY || '';
    this.baseUrl = options.baseUrl || 'https://api.siliconflow.cn/v1';
    this.defaultModel = options.defaultModel || 'kolors';
  }

  /**
   * Initialize the provider
   */
  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('SiliconFlow API key is required. Set SILICONFLOW_API_KEY environment variable.');
    }

    // Validate by checking health
    const health = await this.healthCheck();
    if (!health.healthy) {
      throw new Error(`SiliconFlow provider initialization failed: ${health.message}`);
    }
  }

  /**
   * Generate image
   */
  async generate(config: ProviderConfig): Promise<ProviderResult> {
    const startTime = Date.now();

    try {
      const request: SiliconFlowRequest = {
        model: config.model || this.defaultModel,
        prompt: config.prompt,
        negative_prompt: config.negativePrompt,
        width: config.dimensions.width,
        height: config.dimensions.height,
        steps: config.steps || 30,
        cfg_scale: config.cfg || 7.5,
        seed: config.seed || -1,
      };

      const response = await this.makeRequest('/images/generations', request);

      const latency = Date.now() - startTime;

      if (!response.images || response.images.length === 0) {
        throw new Error('No images returned from SiliconFlow API');
      }

      const image = response.images[0];

      return {
        url: image.url,
        metadata: {
          provider: this.name,
          model: request.model,
          cost: this.calculateCost(request),
          latency,
        },
      };
    } catch (error) {
      throw convertProviderError(error, this.name);
    }
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ProviderConfig): ValidationResult {
    const errors: string[] = [];

    // Check dimensions
    const model = config.model || this.defaultModel;
    const modelConfig = MODEL_CONFIGS[model];

    if (!modelConfig) {
      errors.push(`Unknown model: ${model}`);
      return { valid: false, errors };
    }

    // Validate dimensions
    if (config.dimensions.width > modelConfig.maxSize ||
        config.dimensions.height > modelConfig.maxSize) {
      errors.push(
        `Dimensions exceed maximum for model ${model}. Max: ${modelConfig.maxSize}x${modelConfig.maxSize}`
      );
    }

    // Validate format
    if (!this.capabilities.supportedFormats.includes(config.format)) {
      errors.push(`Unsupported format: ${config.format}. Supported: ${this.capabilities.supportedFormats.join(', ')}`);
    }

    // Validate prompt
    if (!config.prompt || config.prompt.trim().length === 0) {
      errors.push('Prompt is required');
    }

    if (config.prompt && config.prompt.length > 4000) {
      errors.push('Prompt exceeds maximum length of 4000 characters');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Estimate cost
   */
  async estimateCost(config: ProviderConfig): Promise<number> {
    const model = config.model || this.defaultModel;

    // Pricing per 1000 requests (approximate)
    const pricing: Record<string, number> = {
      kolors: 0.015,
      'stable-diffusion-xl': 0.008,
    };

    const basePrice = pricing[model] || 0.015;

    // Adjust for quality/steps
    const stepMultiplier = (config.steps || 30) / 30;

    // Adjust for dimensions
    const pixelCount = config.dimensions.width * config.dimensions.height;
    const sizeMultiplier = pixelCount / (1024 * 1024);

    return basePrice * stepMultiplier * sizeMultiplier;
  }

  /**
   * Check provider health
   */
  async healthCheck(): Promise<HealthStatus> {
    if (!this.apiKey) {
      return {
        healthy: false,
        message: 'API key not configured',
      };
    }

    try {
      const startTime = Date.now();
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return {
          healthy: true,
          latency,
        };
      }

      return {
        healthy: false,
        latency,
        message: `API returned status ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Make API request
   */
  private async makeRequest(endpoint: string, body: unknown): Promise<SiliconFlowResponse> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
      throw {
        code: response.status,
        message: error.message || `HTTP ${response.status}`,
      };
    }

    return response.json() as Promise<SiliconFlowResponse>;
  }

  /**
   * Calculate actual cost
   */
  private calculateCost(request: SiliconFlowRequest): number {
    // Simplified cost calculation
    const pricing: Record<string, number> = {
      kolors: 0.015,
      'stable-diffusion-xl': 0.008,
    };

    const basePrice = pricing[request.model] || 0.015;
    const stepMultiplier = (request.steps || 30) / 30;
    const pixelCount = request.width * request.height;
    const sizeMultiplier = pixelCount / (1024 * 1024);

    return basePrice * stepMultiplier * sizeMultiplier;
  }
}
