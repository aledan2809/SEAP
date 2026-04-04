"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Core Router (smart routing, fallback, health)
// ═══════════════════════════════════════════════════════
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRouter = void 0;
const types_1 = require("./types");
const registry_1 = require("./providers/registry");
const executor_1 = require("./providers/executor");
const smart_router_1 = require("./smart-router");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    providers: registry_1.FREE_PROVIDERS,
    defaultProvider: "auto",
    projectName: "unknown",
    maxInputChars: 4000,
    retryDelayMs: 2000,
    maxRetries: 2,
};
class AIRouter {
    constructor(config = {}) {
        this.roundRobinIndex = 0;
        this.healthMap = new Map();
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize health for all configured providers
        for (const id of this.config.providers) {
            this.healthMap.set(id, {
                id,
                healthy: true,
                lastCheck: Date.now(),
                avgLatencyMs: 0,
                successRate: 1,
                totalCalls: 0,
                totalErrors: 0,
            });
        }
    }
    /** Main entry: route an AI request */
    async chat(request) {
        const provider = request.provider || this.config.defaultProvider;
        if (provider === "auto") {
            return this.smartRoute(request);
        }
        return this.callProvider(provider, request);
    }
    /**
     * Smart Auto mode: analyze request context, score providers,
     * pick the best match, with intelligent fallback ordering.
     * Respects rate limits — avoids providers at warning/critical/exhausted.
     */
    async smartRoute(request) {
        const healthy = this.getHealthyProviders();
        // Filter out providers that are near their rate limit
        const resourceStatus = AIRouter.getResourceStatus();
        // Check Claude CLI weekly budget
        let claudeCliWeeklyBlock = false;
        try {
            const budgetPath = path.join("C:/Projects/AIRouter/config", "claude-cli-budget.json");
            if (fs.existsSync(budgetPath)) {
                const budget = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
                const resetDate = new Date(budget.weeklyResetISO);
                const daysLeft = Math.max(0.1, (resetDate.getTime() - Date.now()) / 86400000);
                const remainingPct = (100 - budget.weeklyUsagePercent) / 100;
                const dailyBudget = remainingPct / daysLeft;
                if (dailyBudget < 0.08) {
                    claudeCliWeeklyBlock = true;
                    console.log(`[ai-router] Claude CLI weekly budget too low (${Math.round(dailyBudget * 100)}%/day) — skipping for non-essential`);
                }
            }
        }
        catch { }
        const available = healthy.filter(id => {
            // Weekly budget block for Claude CLI
            if (claudeCliWeeklyBlock && id === "claude")
                return false;
            const rs = resourceStatus[id];
            if (!rs)
                return true;
            if (rs.status === 'exhausted') {
                console.log(`[ai-router] Skipping ${id} — rate limit exhausted (${rs.used}/${rs.limit})`);
                return false;
            }
            if (rs.status === 'critical') {
                console.log(`[ai-router] Skipping ${id} — rate limit critical (${rs.usagePercent * 100}%)`);
                return false;
            }
            return true;
        });
        if (available.length === 0) {
            // All at limit — try all anyway as last resort (including rate-limited ones)
            console.warn(`[ai-router] All providers at rate limit — trying anyway`);
            return this.fallbackChain(this.config.providers, request);
        }
        // Build smart routing context from the request
        const context = {
            messages: request.messages,
            taskHint: request.taskHint,
            languageHint: request.languageHint,
            speedVsQuality: request.speedVsQuality,
        };
        const { primary, fallbacks } = (0, smart_router_1.smartSelectProvider)(available, context, this.healthMap);
        try {
            const response = await this.callProvider(primary, request);
            return response;
        }
        catch {
            // Primary failed — use smart-ordered fallbacks
            if (fallbacks.length === 0) {
                throw new Error(`[ai-router] Provider ${primary} failed and no fallbacks available`);
            }
            return this.fallbackChain(fallbacks, request, primary);
        }
    }
    /** Try providers sequentially until one succeeds */
    async fallbackChain(providers, request, failedFrom) {
        const errors = [];
        for (const id of providers) {
            try {
                console.log(`[ai-router] Trying ${id} for ${this.config.projectName}`);
                const response = await this.callProvider(id, request);
                if (failedFrom) {
                    response.fallback = true;
                    response.fallbackFrom = failedFrom;
                }
                return response;
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[ai-router] ${id} failed: ${msg.substring(0, 100)}`);
                errors.push(`${id}: ${msg.substring(0, 80)}`);
            }
        }
        throw new Error(`[ai-router] All providers failed: ${errors.join(" | ")}`);
    }
    /** Call a specific provider with retry logic */
    async callProvider(id, request) {
        const overrides = this.config.providerOverrides?.[id];
        const config = (0, registry_1.getProviderConfig)(id, overrides);
        const maxRetries = this.config.maxRetries || 2;
        // Truncate input if configured
        const messages = this.config.maxInputChars
            ? request.messages.map((m) => ({
                ...m,
                content: m.content.substring(0, this.config.maxInputChars),
            }))
            : request.messages;
        let lastError = null;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await (0, executor_1.executeProvider)({
                    config,
                    messages,
                    model: request.model,
                    maxTokens: request.maxTokens,
                    temperature: request.temperature,
                    jsonMode: request.jsonMode,
                });
                this.recordSuccess(id, response.latencyMs, response.tokenUsage);
                return response;
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                const isRateLimit = lastError.message.includes("429") || lastError.message.includes("rate");
                if (isRateLimit && attempt < maxRetries) {
                    const delay = this.config.retryDelayMs * (attempt + 1);
                    console.log(`[ai-router] ${id} rate limited, retrying in ${delay}ms...`);
                    await sleep(delay);
                }
                else if (attempt < maxRetries) {
                    await sleep(500);
                }
            }
        }
        this.recordError(id, lastError?.message || "Unknown error");
        throw lastError || new Error(`[ai-router] ${id} failed after ${maxRetries} retries`);
    }
    /** Get providers that are currently healthy */
    getHealthyProviders() {
        const now = Date.now();
        const RECOVERY_WINDOW = 60000; // 1 min cooldown for unhealthy providers
        return this.config.providers.filter((id) => {
            const health = this.healthMap.get(id);
            if (!health)
                return false;
            if (health.healthy)
                return true;
            // Allow recovery after cooldown
            if (now - health.lastCheck > RECOVERY_WINDOW) {
                health.healthy = true;
                return true;
            }
            return false;
        });
    }
    recordSuccess(id, latencyMs, tokenUsage) {
        const health = this.healthMap.get(id);
        if (!health)
            return;
        health.totalCalls++;
        health.healthy = true;
        health.lastCheck = Date.now();
        health.avgLatencyMs =
            (health.avgLatencyMs * (health.totalCalls - 1) + latencyMs) / health.totalCalls;
        health.successRate = (health.totalCalls - health.totalErrors) / health.totalCalls;
        this.logMetric(id, true, latencyMs, tokenUsage);
    }
    recordError(id, error) {
        const health = this.healthMap.get(id);
        if (!health)
            return;
        health.totalCalls++;
        health.totalErrors++;
        health.lastError = error;
        health.lastCheck = Date.now();
        health.successRate = (health.totalCalls - health.totalErrors) / health.totalCalls;
        this.logMetric(id, false, 0);
        // Mark unhealthy if error rate > 50%
        if (health.totalCalls >= 3 && health.successRate < 0.5) {
            health.healthy = false;
        }
    }
    /** Get health status for all providers */
    getHealth() {
        return Array.from(this.healthMap.values());
    }
    /** Get current config */
    getConfig() {
        return { ...this.config };
    }
    /** Get available providers (with API key set) */
    getAvailableProviders() {
        return this.config.providers.filter((id) => {
            const config = (0, registry_1.getProviderConfig)(id);
            return !!process.env[config.apiKeyEnvVar];
        });
    }
    /** Append a metric entry to the per-project log file */
    logMetric(providerId, success, latencyMs, tokenUsage) {
        try {
            const dir = AIRouter.METRICS_DIR;
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            const logFile = path.join(dir, `${this.config.projectName.toLowerCase()}.jsonl`);
            const entry = {
                ts: new Date().toISOString(),
                provider: providerId,
                project: this.config.projectName,
                success,
                latencyMs,
                tokens: tokenUsage || null,
            };
            fs.appendFileSync(logFile, JSON.stringify(entry) + "\n", "utf8");
        }
        catch {
            // Silent fail — metrics are best-effort
        }
    }
    /** Get aggregated runtime metrics for all providers in this project */
    getRuntimeMetrics() {
        return AIRouter.loadMetrics(this.config.projectName);
    }
    /** Static: load metrics for a given project (callable from outside) */
    static loadMetrics(projectName) {
        const result = {};
        try {
            const logFile = path.join(AIRouter.METRICS_DIR, `${projectName.toLowerCase()}.jsonl`);
            if (!fs.existsSync(logFile))
                return {};
            const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
            for (const line of lines) {
                if (!line)
                    continue;
                try {
                    const entry = JSON.parse(line);
                    if (!result[entry.provider]) {
                        result[entry.provider] = { calls: 0, errors: 0, avgLatency: 0, successRate: 1, totalTokens: 0, _latencySum: 0 };
                    }
                    const m = result[entry.provider];
                    m.calls++;
                    if (!entry.success)
                        m.errors++;
                    m._latencySum += entry.latencyMs;
                    m.avgLatency = Math.round(m._latencySum / m.calls);
                    m.successRate = Math.round(((m.calls - m.errors) / m.calls) * 100) / 100;
                    m.totalTokens += entry.tokens?.total || 0;
                }
                catch { }
            }
        }
        catch { }
        // Clean internal fields
        for (const key of Object.keys(result)) {
            delete result[key]._latencySum;
        }
        return result;
    }
    /** Static: load metrics for ALL projects */
    static loadAllMetrics() {
        const all = {};
        try {
            const dir = AIRouter.METRICS_DIR;
            if (!fs.existsSync(dir))
                return {};
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
            for (const f of files) {
                const project = f.replace('.jsonl', '');
                all[project] = AIRouter.loadMetrics(project);
            }
        }
        catch { }
        return all;
    }
    // ── Resource / Rate Limit Tracking ───────────────────────────
    /**
     * Count calls per provider within a time window, across ALL projects.
     * This gives the global usage for rate limit checking.
     */
    static getProviderUsage(providerId, windowMs) {
        const dir = AIRouter.METRICS_DIR;
        const cutoff = new Date(Date.now() - windowMs).toISOString();
        let count = 0;
        let oldest = null;
        let newest = null;
        try {
            if (!fs.existsSync(dir))
                return { count: 0, oldest: null, newest: null };
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
            for (const f of files) {
                const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n');
                for (const line of lines) {
                    if (!line)
                        continue;
                    try {
                        const entry = JSON.parse(line);
                        if (entry.provider !== providerId)
                            continue;
                        if (entry.ts < cutoff)
                            continue;
                        count++;
                        if (!oldest || entry.ts < oldest)
                            oldest = entry.ts;
                        if (!newest || entry.ts > newest)
                            newest = entry.ts;
                    }
                    catch { }
                }
            }
        }
        catch { }
        return { count, oldest, newest };
    }
    /**
     * Get resource status for all providers: usage vs limits, remaining capacity.
     */
    static getResourceStatus(customLimits) {
        const result = {};
        const allProviders = Object.keys(types_1.DEFAULT_RATE_LIMITS);
        for (const id of allProviders) {
            const limits = { ...types_1.DEFAULT_RATE_LIMITS[id], ...(customLimits?.[id] || {}) };
            const usage = AIRouter.getProviderUsage(id, limits.windowMs);
            const usagePercent = limits.maxRequests > 0 ? usage.count / limits.maxRequests : 0;
            const remaining = Math.max(0, limits.maxRequests - usage.count);
            let status = 'ok';
            if (usagePercent >= 1)
                status = 'exhausted';
            else if (usagePercent >= 0.85)
                status = 'critical';
            else if (usagePercent >= limits.warningThreshold)
                status = 'warning';
            // Estimate when the window resets based on oldest call
            let estimatedResetMs = limits.windowMs;
            if (usage.oldest) {
                const oldestTime = new Date(usage.oldest).getTime();
                estimatedResetMs = Math.max(0, (oldestTime + limits.windowMs) - Date.now());
            }
            result[id] = {
                used: usage.count,
                limit: limits.maxRequests,
                windowMs: limits.windowMs,
                usagePercent: Math.round(usagePercent * 100) / 100,
                remaining,
                status,
                estimatedResetMs,
            };
        }
        return result;
    }
}
exports.AIRouter = AIRouter;
// ── Runtime metrics persistence ──────────────────────────────
AIRouter.METRICS_DIR = "C:/Projects/AIRouter/metrics";
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=router.js.map