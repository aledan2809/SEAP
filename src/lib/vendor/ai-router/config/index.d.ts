import type { AIRouterConfig } from "../types";
/**
 * Recommended defaults per project.
 * Each project can override: default provider, provider list, model overrides.
 */
export declare const PROJECT_PRESETS: Record<string, Partial<AIRouterConfig>>;
/** Get project config by name (case-insensitive), falls back to default */
export declare function getProjectPreset(projectName: string): Partial<AIRouterConfig>;
/** List all available presets */
export declare function listPresets(): string[];
//# sourceMappingURL=index.d.ts.map