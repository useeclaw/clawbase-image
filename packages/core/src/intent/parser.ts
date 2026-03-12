import type {
  ImageIntent,
  IntentType,
  StylePreset,
  QualityLevel,
  ImageDimensions,
} from '../types.js';

// Intent mapping rules from architecture document
export interface IntentMappingRule {
  defaultDimensions: ImageDimensions;
  stylePrompts: Record<string, string>;
  qualitySettings: Record<QualityLevel, { steps: number; cfg: number }>;
}

export const intentMappingRules: Record<string, IntentMappingRule> = {
  'product-photo': {
    defaultDimensions: { width: 1024, height: 1024 },
    stylePrompts: {
      'minimal-white-background': 'product photography, white background, studio lighting, professional',
      'lifestyle-outdoor': 'product photography, outdoor setting, natural lighting, lifestyle',
      'studio-lighting': 'product photography, studio lighting, dramatic shadows, professional',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'hero-banner': {
    defaultDimensions: { width: 1920, height: 1080 },
    stylePrompts: {
      'modern-tech': 'hero banner, modern tech aesthetic, gradient background, minimalist',
      'vibrant': 'hero banner, vibrant colors, dynamic composition, eye-catching',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'avatar': {
    defaultDimensions: { width: 512, height: 512 },
    stylePrompts: {
      'professional': 'professional headshot, neutral background, business attire',
      'casual': 'casual portrait, friendly expression, natural background',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'illustration': {
    defaultDimensions: { width: 1024, height: 1024 },
    stylePrompts: {
      'flat-design': 'flat design illustration, vector style, clean lines, minimal colors',
      'watercolor': 'watercolor illustration, artistic, hand-painted style, soft colors',
      'sketch': 'pencil sketch, hand-drawn style, monochrome, artistic',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'icon': {
    defaultDimensions: { width: 512, height: 512 },
    stylePrompts: {
      'flat-design': 'flat icon design, simple shapes, solid colors, minimalist',
      '3d-render': '3D rendered icon, glossy finish, modern design, depth',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'social-media': {
    defaultDimensions: { width: 1080, height: 1080 },
    stylePrompts: {
      'modern-tech': 'social media post, modern aesthetic, engaging design, shareable',
      'vibrant': 'social media content, vibrant colors, attention-grabbing, trendy',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'presentation': {
    defaultDimensions: { width: 1920, height: 1080 },
    stylePrompts: {
      'minimal-white-background': 'presentation slide, clean design, white background, professional',
      'modern-tech': 'presentation visual, modern tech style, gradient, sleek',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
  'custom': {
    defaultDimensions: { width: 1024, height: 1024 },
    stylePrompts: {
      'photorealistic': 'photorealistic, highly detailed, professional photography',
      '3d-render': '3D rendered image, high quality, detailed textures, professional lighting',
    },
    qualitySettings: {
      low: { steps: 20, cfg: 7 },
      medium: { steps: 30, cfg: 7.5 },
      high: { steps: 50, cfg: 8 },
      ultra: { steps: 100, cfg: 9 },
    },
  },
};

// Default quality mapping
const qualityToLevel: Record<string, QualityLevel> = {
  'low': 'low',
  'medium': 'medium',
  'high': 'high',
  'ultra': 'ultra',
  '标准': 'medium',
  '高清': 'high',
  '超清': 'ultra',
  '普通': 'low',
};

export class IntentParser {
  /**
   * Parse a natural language request into ImageIntent
   */
  parse(input: string): ImageIntent {
    const type = this.classifyIntent(input);
    const subject = this.extractSubject(input, type);
    const style = this.extractStyle(input, type);
    const quality = this.extractQuality(input);

    return {
      type,
      subject,
      style,
      quality,
    };
  }

  /**
   * Build full prompt from intent
   */
  buildPrompt(intent: ImageIntent): string {
    const rule = intentMappingRules[intent.type];
    if (!rule) {
      return intent.subject;
    }

    let prompt = intent.subject;

    // Add style prompt suffix
    if (intent.style && rule.stylePrompts[intent.style]) {
      prompt = `${prompt}, ${rule.stylePrompts[intent.style]}`;
    }

    return prompt;
  }

  /**
   * Get generation parameters for intent
   */
  getGenerationParams(intent: ImageIntent): {
    dimensions: ImageDimensions;
    steps: number;
    cfg: number;
  } {
    const rule = intentMappingRules[intent.type];
    if (!rule) {
      return {
        dimensions: intent.dimensions || { width: 1024, height: 1024 },
        steps: 30,
        cfg: 7.5,
      };
    }

    const quality = intent.quality || 'medium';
    const qualitySettings = rule.qualitySettings[quality];

    return {
      dimensions: intent.dimensions || rule.defaultDimensions,
      steps: qualitySettings.steps,
      cfg: qualitySettings.cfg,
    };
  }

  /**
   * Classify intent type from input
   */
  private classifyIntent(input: string): IntentType {
    const lowerInput = input.toLowerCase();

    // Product photo patterns
    if (/产品|product|商品|item|photo.*product|product.*photo|白底|白背景|white background/.test(lowerInput)) {
      return 'product-photo';
    }

    // Hero banner patterns
    if (/banner|hero|横幅|头图|主视觉|cover|header/.test(lowerInput)) {
      return 'hero-banner';
    }

    // Avatar patterns
    if (/avatar|头像|profile|portrait|照片|自拍/.test(lowerInput)) {
      return 'avatar';
    }

    // Illustration patterns
    if (/illustration|插画|插图|drawing|artwork|艺术/.test(lowerInput)) {
      return 'illustration';
    }

    // Icon patterns
    if (/icon|图标|logo|标志|favicon/.test(lowerInput)) {
      return 'icon';
    }

    // Social media patterns
    if (/social|instagram|post|social.*media|小红书|朋友圈|微博/.test(lowerInput)) {
      return 'social-media';
    }

    // Presentation patterns
    if (/presentation|slide|演示|ppt|keynote|幻灯片/.test(lowerInput)) {
      return 'presentation';
    }

    return 'custom';
  }

  /**
   * Extract subject from input
   */
  private extractSubject(input: string, type: IntentType): string {
    // Remove common descriptive words to get the core subject
    let subject = input
      .replace(/生成|创建|create|generate|make|一张|一个|a|an|the/gi, '')
      .replace(/(的?)(图片|图像|image|picture|photo)/gi, '')
      .replace(/(高清|高质量|high quality|高清|ultra|4k)/gi, '')
      .replace(/(白色?背景|white background|纯白背景)/gi, '')
      .trim();

    // Extract subject based on intent type patterns
    switch (type) {
      case 'product-photo':
        // Match product patterns
        const productMatch = input.match(/(\w+\s*)+(earbuds?|headphones?|phone|laptop|watch|shoes?|bag|camera)/i);
        if (productMatch) {
          subject = productMatch[0];
        }
        break;
      case 'avatar':
        const avatarMatch = input.match(/(\w+\s*)+(person|woman|man|girl|boy|character|professional)/i);
        if (avatarMatch) {
          subject = avatarMatch[0];
        }
        break;
    }

    return subject || input;
  }

  /**
   * Extract style from input
   */
  private extractStyle(input: string, type: IntentType): StylePreset | undefined {
    const lowerInput = input.toLowerCase();
    const rule = intentMappingRules[type];

    if (!rule) return undefined;

    // Check for exact style matches
    for (const [styleKey, stylePrompt] of Object.entries(rule.stylePrompts)) {
      if (lowerInput.includes(styleKey.toLowerCase())) {
        return styleKey as StylePreset;
      }
    }

    // Check for partial matches
    if (/white.*background|白(色)?背景|白底/.test(lowerInput)) {
      return 'minimal-white-background';
    }
    if (/studio.*light|摄影棚|棚拍/.test(lowerInput)) {
      return 'studio-lighting';
    }
    if (/outdoor|户外|外景|lifestyle/.test(lowerInput)) {
      return 'lifestyle-outdoor';
    }
    if (/flat.*design|扁平|矢量/.test(lowerInput)) {
      return 'flat-design';
    }
    if (/3d|render|三维|渲染/.test(lowerInput)) {
      return '3d-render';
    }
    if (/watercolor|水彩/.test(lowerInput)) {
      return 'watercolor';
    }
    if (/sketch|素描|速写|手绘/.test(lowerInput)) {
      return 'sketch';
    }
    if (/realistic|真实|写实/.test(lowerInput)) {
      return 'photorealistic';
    }

    return undefined;
  }

  /**
   * Extract quality level from input
   */
  private extractQuality(input: string): QualityLevel {
    const lowerInput = input.toLowerCase();

    // Check for quality keywords
    if (/ultra|超清|super|最高|4k|8k/.test(lowerInput)) {
      return 'ultra';
    }
    if (/high|高清|高质量|high.*quality/.test(lowerInput)) {
      return 'high';
    }
    if (/low|低质量|低清|draft/.test(lowerInput)) {
      return 'low';
    }

    return 'medium';
  }
}
