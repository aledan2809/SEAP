"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Type Definitions
// ═══════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RATE_LIMITS = void 0;
/** Default rate limits per provider (known limits) */
exports.DEFAULT_RATE_LIMITS = {
    claude: { maxRequests: 45, windowMs: 5 * 3600000, warningThreshold: 0.6 },
    openai: { maxRequests: 500, windowMs: 3600000, warningThreshold: 0.8 },
    gemini: { maxRequests: 1500, windowMs: 86400000, warningThreshold: 0.8 },
    mistral: { maxRequests: 1000, windowMs: 86400000, warningThreshold: 0.8 },
    groq: { maxRequests: 30, windowMs: 60000, warningThreshold: 0.7 },
    cohere: { maxRequests: 1000, windowMs: 86400000, warningThreshold: 0.8 },
    together: { maxRequests: 600, windowMs: 3600000, warningThreshold: 0.8 },
    fireworks: { maxRequests: 600, windowMs: 3600000, warningThreshold: 0.8 },
    cerebras: { maxRequests: 30, windowMs: 60000, warningThreshold: 0.7 },
    openrouter: { maxRequests: 200, windowMs: 60000, warningThreshold: 0.8 },
    deepinfra: { maxRequests: 500, windowMs: 3600000, warningThreshold: 0.8 },
    sambanova: { maxRequests: 100, windowMs: 3600000, warningThreshold: 0.8 },
    novita: { maxRequests: 300, windowMs: 3600000, warningThreshold: 0.8 },
    lepton: { maxRequests: 300, windowMs: 3600000, warningThreshold: 0.8 },
    hyperbolic: { maxRequests: 300, windowMs: 3600000, warningThreshold: 0.8 },
    perplexity: { maxRequests: 50, windowMs: 60000, warningThreshold: 0.7 },
    "claude-cli": { maxRequests: 30, windowMs: 3600000, warningThreshold: 0.7 },
};
//# sourceMappingURL=types.js.map