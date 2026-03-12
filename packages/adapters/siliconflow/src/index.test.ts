import { describe, it, expect } from 'vitest';
import { SiliconFlowProvider } from '../src/index.js';

describe('SiliconFlowProvider', () => {
  const provider = new SiliconFlowProvider({
    apiKey: 'test-key',
    defaultModel: 'kolors',
  });

  it('should have correct name', () => {
    expect(provider.name).toBe('siliconflow');
  });

  it('should support product-photo intent', () => {
    expect(provider.supportedIntents).toContain('product-photo');
  });

  it('should validate correct config', () => {
    const result = provider.validateConfig({
      prompt: 'test prompt',
      dimensions: { width: 1024, height: 1024 },
      format: 'png',
    });

    expect(result.valid).toBe(true);
  });

  it('should reject invalid dimensions', () => {
    const result = provider.validateConfig({
      prompt: 'test prompt',
      dimensions: { width: 4096, height: 4096 },
      format: 'png',
      model: 'kolors',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('Dimensions exceed maximum'));
  });

  it('should reject unsupported format', () => {
    const result = provider.validateConfig({
      prompt: 'test prompt',
      dimensions: { width: 512, height: 512 },
      format: 'webp' as 'png', // Cast to bypass type checking
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(expect.stringContaining('Unsupported format'));
  });

  it('should reject empty prompt', () => {
    const result = provider.validateConfig({
      prompt: '',
      dimensions: { width: 512, height: 512 },
      format: 'png',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Prompt is required');
  });

  it('should calculate cost', async () => {
    const cost = await provider.estimateCost({
      prompt: 'test',
      dimensions: { width: 1024, height: 1024 },
      format: 'png',
      model: 'kolors',
      steps: 30,
    });

    expect(cost).toBeGreaterThan(0);
  });
});
