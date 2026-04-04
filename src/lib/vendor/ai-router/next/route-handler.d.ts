import { AIRouter } from "../router";
export interface AIRouteHandlerOptions {
    /** Project name (matches preset configs) */
    projectName: string;
    /** Additional router config overrides */
    routerConfig?: Record<string, unknown>;
}
/** Creates Next.js route handlers for AI routing */
export declare function createAIRouteHandler(options: AIRouteHandlerOptions): {
    /** POST /api/ai — Chat with AI */
    POST: (request: Request) => Promise<Response>;
    /** GET /api/ai — Provider info & health */
    GET: () => Promise<Response>;
    /** The router instance (for direct use) */
    router: AIRouter;
};
//# sourceMappingURL=route-handler.d.ts.map