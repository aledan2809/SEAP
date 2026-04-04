"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Next.js API Route Handler Factory
// ═══════════════════════════════════════════════════════
//
// Usage in a Next.js API route:
//
//   // app/api/ai/route.ts
//   import { createAIRouteHandler } from "ai-router/next";
//   const handler = createAIRouteHandler({ projectName: "MyProject" });
//   export const POST = handler.POST;
//   export const GET = handler.GET;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAIRouteHandler = createAIRouteHandler;
const router_1 = require("../router");
const config_1 = require("../config");
const registry_1 = require("../providers/registry");
/** Creates Next.js route handlers for AI routing */
function createAIRouteHandler(options) {
    const preset = (0, config_1.getProjectPreset)(options.projectName);
    const router = new router_1.AIRouter({ ...preset, ...options.routerConfig });
    return {
        /** POST /api/ai — Chat with AI */
        POST: async (request) => {
            try {
                const body = await request.json();
                const { messages, provider = preset.defaultProvider || "auto", model, maxTokens, temperature, jsonMode, } = body;
                if (!messages || !Array.isArray(messages) || messages.length === 0) {
                    return Response.json({ error: "messages is required and must be a non-empty array" }, { status: 400 });
                }
                const response = await router.chat({
                    messages,
                    provider,
                    model,
                    maxTokens,
                    temperature,
                    jsonMode,
                });
                return Response.json(response);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "Internal error";
                console.error(`[ai-router] ${options.projectName} error:`, message);
                return Response.json({ error: message }, { status: 500 });
            }
        },
        /** GET /api/ai — Provider info & health */
        GET: async () => {
            const health = router.getHealth();
            const available = router.getAvailableProviders();
            const config = router.getConfig();
            // Provider list with availability info
            const providers = registry_1.ALL_PROVIDER_IDS.map((id) => {
                const cfg = (0, registry_1.getProviderConfig)(id);
                return {
                    id: cfg.id,
                    name: cfg.name,
                    label: cfg.label,
                    tier: cfg.tier,
                    available: available.includes(id),
                    enabled: config.providers.includes(id),
                };
            });
            return Response.json({
                projectName: config.projectName,
                defaultProvider: config.defaultProvider,
                providers,
                health,
                availableProviders: available,
            });
        },
        /** The router instance (for direct use) */
        router,
    };
}
//# sourceMappingURL=route-handler.js.map