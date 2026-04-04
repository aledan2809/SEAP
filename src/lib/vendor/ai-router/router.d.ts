import type { AIProviderID, AIRouterConfig, AIRequest, AIResponse, ProviderHealth, ProviderRateLimit } from "./types";
export declare class AIRouter {
    private config;
    private roundRobinIndex;
    private healthMap;
    constructor(config?: Partial<AIRouterConfig>);
    /** Main entry: route an AI request */
    chat(request: AIRequest): Promise<AIResponse>;
    /**
     * Smart Auto mode: analyze request context, score providers,
     * pick the best match, with intelligent fallback ordering.
     * Respects rate limits — avoids providers at warning/critical/exhausted.
     */
    private smartRoute;
    /** Try providers sequentially until one succeeds */
    private fallbackChain;
    /** Call a specific provider with retry logic */
    private callProvider;
    /** Get providers that are currently healthy */
    private getHealthyProviders;
    private recordSuccess;
    private recordError;
    /** Get health status for all providers */
    getHealth(): ProviderHealth[];
    /** Get current config */
    getConfig(): AIRouterConfig;
    /** Get available providers (with API key set) */
    getAvailableProviders(): AIProviderID[];
    private static readonly METRICS_DIR;
    /** Append a metric entry to the per-project log file */
    private logMetric;
    /** Get aggregated runtime metrics for all providers in this project */
    getRuntimeMetrics(): Record<AIProviderID, {
        calls: number;
        errors: number;
        avgLatency: number;
        successRate: number;
        totalTokens: number;
    }>;
    /** Static: load metrics for a given project (callable from outside) */
    static loadMetrics(projectName: string): Record<string, {
        calls: number;
        errors: number;
        avgLatency: number;
        successRate: number;
        totalTokens: number;
    }>;
    /** Static: load metrics for ALL projects */
    static loadAllMetrics(): Record<string, Record<string, {
        calls: number;
        errors: number;
        avgLatency: number;
        successRate: number;
        totalTokens: number;
    }>>;
    /**
     * Count calls per provider within a time window, across ALL projects.
     * This gives the global usage for rate limit checking.
     */
    static getProviderUsage(providerId: string, windowMs: number): {
        count: number;
        oldest: string | null;
        newest: string | null;
    };
    /**
     * Get resource status for all providers: usage vs limits, remaining capacity.
     */
    static getResourceStatus(customLimits?: Partial<Record<string, ProviderRateLimit>>): Record<string, {
        used: number;
        limit: number;
        windowMs: number;
        usagePercent: number;
        remaining: number;
        status: 'ok' | 'warning' | 'critical' | 'exhausted';
        estimatedResetMs: number;
    }>;
}
//# sourceMappingURL=router.d.ts.map