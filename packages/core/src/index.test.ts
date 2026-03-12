import { describe, it, expect } from 'vitest';
import { IntentParser } from '../src/intent/parser.js';
import { CircuitBreaker, ProviderRouter } from '../src/router/index.js';
import { CacheManager } from '../src/cache/manager.js';
import { AgentFriendlyError, ErrorCodes } from '../src/errors/index.js';

describe('IntentParser', () => {
  const parser = new IntentParser();

  it('should classify product-photo intent', () => {
    const intent = parser.parse('生成一张无线耳机产品图，白色背景');
    expect(intent.type).toBe('product-photo');
    expect(intent.style).toBe('minimal-white-background');
  });

  it('should classify avatar intent', () => {
    const intent = parser.parse('创建一个专业头像');
    expect(intent.type).toBe('avatar');
  });

  it('should classify hero-banner intent', () => {
    const intent = parser.parse('生成一个网站横幅');
    expect(intent.type).toBe('hero-banner');
  });

  it('should extract quality', () => {
    const intent = parser.parse('生成高清图片');
    expect(intent.quality).toBe('high');
  });

  it('should build prompt correctly', () => {
    const intent = {
      type: 'product-photo' as const,
      subject: 'wireless earbuds',
      style: 'minimal-white-background' as const,
      quality: 'high' as const,
    };

    const prompt = parser.buildPrompt(intent);
    expect(prompt).toContain('wireless earbuds');
    expect(prompt).toContain('product photography');
    expect(prompt).toContain('white background');
  });

  it('should get generation params', () => {
    const intent = {
      type: 'product-photo' as const,
      subject: 'test',
      quality: 'high' as const,
    };

    const params = parser.getGenerationParams(intent);
    expect(params.steps).toBe(50);
    expect(params.cfg).toBe(8);
    expect(params.dimensions.width).toBe(1024);
  });
});

describe('CircuitBreaker', () => {
  it('should start in closed state', () => {
    const cb = new CircuitBreaker();
    expect(cb.canExecute()).toBe(true);
    expect(cb.getState()).toBe('closed');
  });

  it('should open after threshold failures', () => {
    const cb = new CircuitBreaker(3, 60000);

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canExecute()).toBe(true);

    cb.recordFailure();
    expect(cb.canExecute()).toBe(false);
    expect(cb.getState()).toBe('open');
  });

  it('should reset on success', () => {
    const cb = new CircuitBreaker(3, 60000);

    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();

    expect(cb.getFailureCount()).toBe(0);
    expect(cb.canExecute()).toBe(true);
  });
});

describe('CacheManager', () => {
  const config = {
    type: 'memory' as const,
    ttl: { url: 3600, image: 86400 },
    maxSize: 100,
    maxEntries: 1000,
  };

  it('should store and retrieve entries', async () => {
    const cache = new CacheManager(config);

    await cache.set('test-key', 'https://example.com/image.png', {
      provider: 'test',
      model: 'test-model',
      cost: 0.01,
    });

    const entry = await cache.get('test-key');
    expect(entry).not.toBeNull();
    expect(entry?.url).toBe('https://example.com/image.png');
    expect(entry?.metadata.provider).toBe('test');
  });

  it('should return null for missing keys', async () => {
    const cache = new CacheManager(config);
    const entry = await cache.get('non-existent');
    expect(entry).toBeNull();
  });

  it('should track hit count', async () => {
    const cache = new CacheManager(config);

    await cache.set('test-key', 'https://example.com/image.png', {
      provider: 'test',
      model: 'test-model',
      cost: 0.01,
    });

    await cache.get('test-key');
    await cache.get('test-key');

    const entry = await cache.get('test-key');
    expect(entry?.metadata.hitCount).toBeGreaterThan(1);
  });
});

describe('AgentFriendlyError', () => {
  it('should create error with all properties', () => {
    const error = new AgentFriendlyError({
      code: ErrorCodes.PROVIDER_RATE_LIMIT,
      message: 'Rate limit exceeded',
      suggestion: 'Wait and try again',
    });

    expect(error.code).toBe(ErrorCodes.PROVIDER_RATE_LIMIT);
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.suggestion).toBe('Wait and try again');
  });

  it('should serialize to JSON', () => {
    const error = new AgentFriendlyError({
      code: ErrorCodes.PROVIDER_RATE_LIMIT,
      message: 'Rate limit exceeded',
      suggestion: 'Wait and try again',
    });

    const json = error.toJSON();
    expect(json.code).toBe(ErrorCodes.PROVIDER_RATE_LIMIT);
    expect(json.hasFix).toBe(false);
  });
});
