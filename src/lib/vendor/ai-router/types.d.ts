export type AIProviderID = "groq" | "gemini" | "claude" | "claude-cli" | "openai" | "mistral" | "cohere" | "together" | "fireworks" | "cerebras" | "openrouter" | "deepinfra" | "sambanova" | "novita" | "lepton" | "hyperbolic" | "perplexity";
export type AIProviderSelection = AIProviderID | "auto";
export interface AIProviderConfig {
    id: AIProviderID;
    name: string;
    label: string;
    tier: "free" | "paid" | "freemium";
    apiKeyEnvVar: string;
    baseUrl: string;
    defaultModel: string;
    models: string[];
    maxTokens: number;
    temperature: number;
    enabled: boolean;
    /** Provider-specific headers or config */
    headers?: Record<string, string>;
    /** Signup/dashboard URL */
    signupUrl?: string;
    /** Short description of free tier */
    freeTierNote?: string;
}
export interface AIRouterConfig {
    /** Providers to include in round-robin (order matters for fallback) */
    providers: AIProviderID[];
    /** Default provider for this project (null = auto) */
    defaultProvider: AIProviderSelection;
    /** Project name (for logging) */
    projectName: string;
    /** Max chars for input truncation (free tier protection) */
    maxInputChars?: number;
    /** Delay between retries in ms */
    retryDelayMs?: number;
    /** Max retry attempts per provider */
    maxRetries?: number;
    /** Custom provider overrides (model, temperature, etc.) */
    providerOverrides?: Partial<Record<AIProviderID, Partial<AIProviderConfig>>>;
}
export interface AIMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface AIRequest {
    messages: AIMessage[];
    provider?: AIProviderSelection;
    /** Override model for this request */
    model?: string;
    /** Override max tokens for this request */
    maxTokens?: number;
    /** Override temperature for this request */
    temperature?: number;
    /** Request JSON response format */
    jsonMode?: boolean;
    /** Smart routing: hint about content language */
    languageHint?: "ro" | "en" | "eu" | "international";
    /** Smart routing: hint about task type */
    taskHint?: "generation" | "analysis" | "summarization" | "classification" | "extraction" | "conversation" | "translation" | "code";
    /** Smart routing: prefer speed (1.0) vs quality (0.0), default 0.3 */
    speedVsQuality?: number;
}
export interface AIResponse {
    content: string;
    provider: AIProviderID;
    model: string;
    tokenUsage?: {
        input?: number;
        output?: number;
        total?: number;
    };
    latencyMs: number;
    /** Was this a fallback from another provider? */
    fallback: boolean;
    fallbackFrom?: AIProviderID;
}
export interface ProviderHealth {
    id: AIProviderID;
    healthy: boolean;
    lastCheck: number;
    lastError?: string;
    avgLatencyMs: number;
    successRate: number;
    totalCalls: number;
    totalErrors: number;
}
/** Rate limit / resource budget config per provider */
export interface ProviderRateLimit {
    /** Max requests per window */
    maxRequests: number;
    /** Window duration in ms (e.g., 3600000 = 1 hour) */
    windowMs: number;
    /** Threshold % (0-1) at which to start avoiding this provider. Default 0.6 */
    warningThreshold: number;
    /** Reset time (ISO string or cron-like). Null = rolling window */
    resetTime?: string;
}
/** Default rate limits per provider (known limits) */
export declare const DEFAULT_RATE_LIMITS: Record<AIProviderID, ProviderRateLimit>;
//# sourceMappingURL=types.d.ts.map