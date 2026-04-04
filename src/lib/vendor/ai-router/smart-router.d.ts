import type { AIProviderID, AIMessage, ProviderHealth } from "./types";
export type TaskType = "generation" | "analysis" | "summarization" | "classification" | "extraction" | "conversation" | "translation" | "code" | "unknown";
export interface SmartRouteContext {
    messages: AIMessage[];
    /** Optional hint about what language the content is in */
    languageHint?: "ro" | "en" | "eu" | "international";
    /** Optional hint about what type of task this is */
    taskHint?: TaskType;
    /** Prefer speed over quality? (0 = quality, 1 = speed) */
    speedVsQuality?: number;
}
export interface ProviderScore {
    id: AIProviderID;
    totalScore: number;
    breakdown: {
        language: number;
        task: number;
        health: number;
        cost: number;
        speed: number;
        resourceBonus: number;
    };
}
/**
 * Score all providers for a given request context.
 * Returns providers sorted by score (highest first).
 *
 * Resource-aware: when two providers have similar scores (within threshold),
 * prefer the one with more free headroom remaining. This preserves expensive
 * providers for tasks that truly need them while routing easy tasks to
 * providers with plenty of capacity left.
 */
export declare function scoreProviders(availableProviders: AIProviderID[], context: SmartRouteContext, healthMap: Map<AIProviderID, ProviderHealth>): ProviderScore[];
/** Get the best provider for a request, plus ordered fallback list */
export declare function smartSelectProvider(availableProviders: AIProviderID[], context: SmartRouteContext, healthMap: Map<AIProviderID, ProviderHealth>): {
    primary: AIProviderID;
    fallbacks: AIProviderID[];
    scores: ProviderScore[];
};
//# sourceMappingURL=smart-router.d.ts.map