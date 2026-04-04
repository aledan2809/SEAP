import type { AIProviderConfig, AIMessage, AIResponse } from "../types";
interface ExecOptions {
    config: AIProviderConfig;
    messages: AIMessage[];
    model?: string;
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
}
/** Execute a request against a specific provider */
export declare function executeProvider(opts: ExecOptions): Promise<AIResponse>;
export {};
//# sourceMappingURL=executor.d.ts.map