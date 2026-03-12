# ClawBase Image

AI-native image generation SDK for coding agents. ClawBase Image provides a unified interface for generating images through multiple providers, with intelligent intent parsing, automatic provider routing, and built-in caching.

## Features

- **Intent-Based Generation**: Describe what you need in natural language
- **Multi-Provider Support**: SiliconFlow adapter included, extensible architecture
- **Smart Routing**: Automatically selects the best provider based on cost, quality, and availability
- **Built-in Caching**: Avoid redundant API calls with intelligent caching
- **Agent-Friendly Errors**: Clear error messages with actionable suggestions
- **Circuit Breaker**: Automatic failover when providers are unavailable
- **TypeScript First**: Full type safety with comprehensive type definitions

## Quick Start

```typescript
import { ClawBaseCore } from '@clawbase/core';
import { SiliconFlowProvider } from '@clawbase/adapter-siliconflow';

// Initialize core SDK
const clawbase = new ClawBaseCore({
  core: {
    defaultProvider: 'siliconflow',
    maxRetries: 3,
  },
});

// Register SiliconFlow provider
const siliconflow = new SiliconFlowProvider({
  apiKey: process.env.SILICONFLOW_API_KEY,
});
clawbase.registerProvider(siliconflow);

// Generate an image from natural language
const result = await clawbase.generateFromText(
  '生成一张无线耳机的产品图，白色背景，高清'
);

console.log(result.url);
console.log(`Cost: $${result.metadata.cost}`);
console.log(`Latency: ${result.metadata.latency}ms`);
```

## Intent Types

ClawBase Image supports various intent types that are automatically detected from your description:

| Intent Type | Description | Example |
|------------|-------------|---------|
| `product-photo` | Product photography with various backgrounds | "无线耳机白底图" |
| `hero-banner` | Website hero banners | "网站首页横幅" |
| `avatar` | Profile pictures and portraits | "专业头像" |
| `illustration` | Artistic illustrations | "扁平风格插画" |
| `icon` | App icons and logos | "App 图标" |
| `social-media` | Social media posts | "Instagram 帖子" |
| `presentation` | Presentation slides | "PPT 封面" |
| `custom` | Custom generation | Any other description |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Input    │────▶│  Intent Parser  │────▶│ Provider Router │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
       ┌────────────────┬───────────────┬───────────────┼───────────────┐
       ▼                ▼               ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ SiliconFlow │  │  Provider B │ │  Provider C │ │  Provider D │ │  Provider E │
└─────────────┘  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@clawbase/core` | Core SDK with routing, caching, and error handling |
| `@clawbase/adapter-siliconflow` | SiliconFlow provider adapter |
| `@clawbase/openclaw` | MCP-compatible skill wrapper |

## Installation

```bash
# Install core SDK
npm install @clawbase/core

# Install SiliconFlow adapter
npm install @clawbase/adapter-siliconflow

# Or install all packages
npm install @clawbase/core @clawbase/adapter-siliconflow
```

## Configuration

### Environment Variables

```bash
# SiliconFlow API Key (required for SiliconFlow adapter)
SILICONFLOW_API_KEY=your_api_key_here
```

### SDK Configuration

```typescript
const clawbase = new ClawBaseCore({
  core: {
    defaultProvider: 'siliconflow',
    fallbackEnabled: true,
    maxRetries: 3,
    timeout: 30000,
  },
  cache: {
    type: 'memory',
    ttl: {
      url: 3600,    // 1 hour
      image: 86400, // 24 hours
    },
    maxEntries: 1000,
  },
  routing: {
    strategy: 'smart', // 'smart' | 'cost-optimized' | 'quality-first' | 'manual'
  },
  budget: {
    daily: 100,
    monthly: 2000,
  },
});
```

## Advanced Usage

### Custom Intent

```typescript
import { ImageIntent } from '@clawbase/core';

const intent: ImageIntent = {
  type: 'product-photo',
  subject: 'wireless earbuds',
  style: 'minimal-white-background',
  quality: 'high',
  dimensions: { width: 1024, height: 1024 },
};

const result = await clawbase.generate(intent);
```

### Provider Status

```typescript
const status = await clawbase.getProviderStatus('siliconflow');
console.log(status.available); // true/false
console.log(status.circuitBreakerState); // 'closed' | 'open' | 'half-open'
```

### Cache Management

```typescript
// Get cache statistics
const stats = clawbase.getCacheStats();
console.log(`Cache size: ${stats.size}/${stats.maxEntries}`);
console.log(`Hit rate: ${stats.hitRate}`);

// Clear cache
await clawbase.clearCache();
```

### Error Handling

```typescript
import { AgentFriendlyError } from '@clawbase/core';

try {
  const result = await clawbase.generateFromText('...');
} catch (error) {
  if (error instanceof AgentFriendlyError) {
    console.log(error.code);      // Error code
    console.log(error.message);   // Human-readable message
    console.log(error.suggestion); // Actionable suggestion

    // Some errors have auto-fix functions
    if (error.fix) {
      await error.fix();
    }
  }
}
```

## Provider Support

### SiliconFlow

Supported models:
- `kolors` (default): High-quality image generation
- `stable-diffusion-xl`: Fast, efficient generation

Supported intents:
- product-photo
- avatar
- illustration
- icon
- social-media
- custom

## Development

```bash
# Clone repository
git clone https://github.com/your-org/clawbase-image.git
cd clawbase-image

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @clawbase/core test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Roadmap

- [ ] Additional provider adapters (OpenAI DALL-E, Stability AI, etc.)
- [ ] Batch generation support
- [ ] Image editing capabilities
- [ ] Redis cache backend
- [ ] Budget tracking and alerts
- [ ] Usage analytics dashboard

## Support

- Documentation: [https://clawbase.dev/docs/image](https://clawbase.dev/docs/image)
- Issues: [GitHub Issues](https://github.com/your-org/clawbase-image/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/clawbase-image/discussions)
