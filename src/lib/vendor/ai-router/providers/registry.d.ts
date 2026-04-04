import type { AIProviderConfig, AIProviderID } from "../types";
export declare const PROVIDER_REGISTRY: Record<AIProviderID, AIProviderConfig>;
/** Get provider config with optional overrides merged */
export declare function getProviderConfig(id: AIProviderID, overrides?: Partial<AIProviderConfig>): AIProviderConfig;
/** All provider IDs */
export declare const ALL_PROVIDER_IDS: AIProviderID[];
/** Free-tier-only providers (for round-robin default) */
export declare const FREE_PROVIDERS: AIProviderID[];
//# sourceMappingURL=registry.d.ts.map