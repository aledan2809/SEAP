"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Smart Routing Engine
// ═══════════════════════════════════════════════════════
//
// When "auto" is selected, instead of blind round-robin,
// this engine scores each provider based on:
//   1. Language & locale match (Romanian, EU, international)
//   2. Task type match (generation, summarization, classification, etc.)
//   3. Historical performance (success rate, latency)
//   4. Cost tier (free first, paid as fallback)
//   5. Provider strengths/weaknesses per domain
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreProviders = scoreProviders;
exports.smartSelectProvider = smartSelectProvider;
const registry_1 = require("./providers/registry");
const router_1 = require("./router");
// ── Language Detection ──────────────────────────────────
/** Romanian-specific markers (diacritics, common words) */
const RO_MARKERS = [
    /[ăâîșțĂÂÎȘȚ]/,
    /\b(și|sau|este|sunt|care|pentru|acest|această|din|prin|mai|fost|avea|face|poate|bine|lucr|furniz|produs|servic|clie|comand|factur|plat[ăi])\b/i,
];
/** Detect if text is primarily Romanian */
function isRomanianText(text) {
    const sample = text.substring(0, 2000);
    let score = 0;
    for (const marker of RO_MARKERS) {
        if (marker.test(sample))
            score++;
    }
    return score >= 2; // Need at least 2 markers
}
/** Detect if content relates to EU/European context */
function isEuropeanContext(text) {
    const sample = text.toLowerCase().substring(0, 2000);
    const euMarkers = [
        /\b(gdpr|rgpd|ue|eu|europe|european)\b/,
        /\b(romania|român|bucharest|bucurești)\b/,
        /\b(furnizor|produc[ăe]|magazin|comand[ăe])\b/i,
        /\b(factur[ăe]|plat[ăi]|tva|impozit)\b/i,
        /\b(asocia[tț]i[ea]|bloc|scar[ăe]|cheltuial[ăe])\b/i,
    ];
    return euMarkers.some((m) => m.test(sample));
}
/** Detect task type from messages */
function detectTaskType(messages) {
    const allText = messages.map((m) => m.content).join(" ").toLowerCase().substring(0, 3000);
    // Order matters: more specific patterns first
    if (/\b(traduc|translat|übersetze|traduire)\b/.test(allText))
        return "translation";
    if (/\b(cod|code|function|class|import|export|const|var|let|def |return )\b/.test(allText) &&
        /\b(genere|scrie|write|implement|fix|debug)\b/.test(allText))
        return "code";
    if (/\b(rezum|summar|sumariz|synopsis|brief|tl;?dr)\b/.test(allText))
        return "summarization";
    if (/\b(clasific|categoriz|categorise|sortea|tipolog)\b/.test(allText))
        return "classification";
    if (/\b(extrage|extract|parse|structur)\b/.test(allText))
        return "extraction";
    if (/\b(anali[zs]|trend|bull|bear|signal|market|trading|preț|price|forecast)\b/.test(allText))
        return "analysis";
    if (/\b(genere|creat|scrie|write|compune|draft|articol|content)\b/.test(allText))
        return "generation";
    if (messages.length >= 3 || /\b(chat|întreab|help|ajut|cum |ce |de ce)\b/.test(allText))
        return "conversation";
    return "unknown";
}
const PROVIDER_STRENGTHS = {
    claude: {
        romanian: 1.8, // Best for Romanian — deep understanding
        european: 1.6,
        international: 1.7,
        generation: 1.8,
        analysis: 1.7,
        summarization: 1.6,
        classification: 1.5,
        extraction: 1.6,
        conversation: 1.8,
        translation: 1.5,
        code: 1.9,
        speed: 0.8, // Slower but higher quality
        quality: 1.9,
    },
    openai: {
        romanian: 1.3,
        european: 1.2,
        international: 1.8,
        generation: 1.7,
        analysis: 1.6,
        summarization: 1.5,
        classification: 1.5,
        extraction: 1.7,
        conversation: 1.7,
        translation: 1.4,
        code: 1.8,
        speed: 1.2,
        quality: 1.7,
    },
    gemini: {
        romanian: 1.2,
        european: 1.3,
        international: 1.6,
        generation: 1.5,
        analysis: 1.4,
        summarization: 1.6,
        classification: 1.4,
        extraction: 1.5,
        conversation: 1.5,
        translation: 1.6, // Good at translation
        code: 1.4,
        speed: 1.5,
        quality: 1.4,
    },
    mistral: {
        romanian: 1.4, // EU-based, decent Romanian
        european: 1.8, // Best for EU context (French company, GDPR native)
        international: 1.3,
        generation: 1.4,
        analysis: 1.3,
        summarization: 1.4,
        classification: 1.3,
        extraction: 1.3,
        conversation: 1.3,
        translation: 1.5, // Good EU language support
        code: 1.5,
        speed: 1.4,
        quality: 1.3,
    },
    groq: {
        romanian: 1.3, // Llama 3.3 70B knows Romanian suppliers — doesn't understand Romanian suppliers well
        european: 0.8,
        international: 1.4,
        generation: 1.2,
        analysis: 1.3,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.8,
        code: 1.3,
        speed: 1.9, // Fastest inference
        quality: 1.1,
    },
    cohere: {
        romanian: 0.9,
        european: 1.1,
        international: 1.4,
        generation: 1.3,
        analysis: 1.1,
        summarization: 1.7, // Excellent for summarization (their specialty)
        classification: 1.6, // Good at classification
        extraction: 1.5,
        conversation: 1.2,
        translation: 1.0,
        code: 0.9,
        speed: 1.3,
        quality: 1.3,
    },
    together: {
        romanian: 0.8,
        european: 0.9,
        international: 1.3,
        generation: 1.3,
        analysis: 1.2,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 1.5,
        quality: 1.2,
    },
    fireworks: {
        romanian: 0.8,
        european: 0.9,
        international: 1.3,
        generation: 1.2,
        analysis: 1.2,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 1.6,
        quality: 1.2,
    },
    // ── New providers ────────────────────────────────────────
    cerebras: {
        romanian: 0.9,
        european: 0.9,
        international: 1.4,
        generation: 1.3,
        analysis: 1.3,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 2.0, // Fastest inference in the world (wafer-scale)
        quality: 1.2,
    },
    openrouter: {
        romanian: 1.0,
        european: 1.0,
        international: 1.4,
        generation: 1.3,
        analysis: 1.3,
        summarization: 1.3,
        classification: 1.2,
        extraction: 1.2,
        conversation: 1.3,
        translation: 1.0,
        code: 1.3,
        speed: 1.3,
        quality: 1.3, // Aggregator — quality depends on model chosen
    },
    deepinfra: {
        romanian: 0.9,
        european: 0.9,
        international: 1.4,
        generation: 1.3,
        analysis: 1.3,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.2,
        conversation: 1.2,
        translation: 0.9,
        code: 1.4,
        speed: 1.7, // Fast, cheap inference
        quality: 1.3,
    },
    sambanova: {
        romanian: 0.9,
        european: 0.9,
        international: 1.3,
        generation: 1.2,
        analysis: 1.2,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 1.8, // Custom silicon — very fast
        quality: 1.2,
    },
    novita: {
        romanian: 0.8,
        european: 0.8,
        international: 1.3,
        generation: 1.2,
        analysis: 1.1,
        summarization: 1.1,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.1,
        translation: 0.8,
        code: 1.2,
        speed: 1.4,
        quality: 1.1,
    },
    lepton: {
        romanian: 0.8,
        european: 0.8,
        international: 1.3,
        generation: 1.2,
        analysis: 1.2,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 1.5,
        quality: 1.2,
    },
    hyperbolic: {
        romanian: 0.8,
        european: 0.8,
        international: 1.3,
        generation: 1.2,
        analysis: 1.2,
        summarization: 1.2,
        classification: 1.1,
        extraction: 1.1,
        conversation: 1.2,
        translation: 0.9,
        code: 1.3,
        speed: 1.6,
        quality: 1.2,
    },
    perplexity: {
        romanian: 1.0,
        european: 1.0,
        international: 1.5,
        generation: 1.3,
        analysis: 1.6, // Search-augmented — great for analysis
        summarization: 1.5,
        classification: 1.2,
        extraction: 1.5, // Good at extracting from web
        conversation: 1.4,
        translation: 1.0,
        code: 1.1,
        speed: 1.2,
        quality: 1.4,
    },
    "claude-cli": {
        romanian: 1.8,
        european: 1.6,
        international: 1.6,
        generation: 1.7,
        analysis: 1.8,
        summarization: 1.6,
        classification: 1.5,
        extraction: 1.6,
        conversation: 1.7,
        translation: 1.5,
        code: 1.9,
        speed: 0.6, // Slow — spawns local process
        quality: 1.8,
    },
};
// ── Cost Scoring ────────────────────────────────────────
const TIER_SCORE = {
    free: 2.0,
    freemium: 1.5,
    paid: 0.5,
};
/**
 * Score all providers for a given request context.
 * Returns providers sorted by score (highest first).
 *
 * Resource-aware: when two providers have similar scores (within threshold),
 * prefer the one with more free headroom remaining. This preserves expensive
 * providers for tasks that truly need them while routing easy tasks to
 * providers with plenty of capacity left.
 */
function scoreProviders(availableProviders, context, healthMap) {
    const allText = context.messages.map((m) => m.content).join(" ");
    const speedPref = context.speedVsQuality ?? 0.3; // Default: slightly favor quality
    // Detect language context
    const isRo = context.languageHint === "ro" || isRomanianText(allText);
    const isEu = context.languageHint === "eu" || isEuropeanContext(allText);
    // Detect task type
    const taskType = context.taskHint || detectTaskType(context.messages);
    // Get resource status for all providers (how much free space remains)
    let resourceStatus = {};
    try {
        resourceStatus = router_1.AIRouter.getResourceStatus();
    }
    catch {
        // Resource tracking unavailable — skip bonus
    }
    const scores = availableProviders.map((id) => {
        const strengths = PROVIDER_STRENGTHS[id];
        const config = registry_1.PROVIDER_REGISTRY[id];
        const health = healthMap.get(id);
        // 1. Language score (weight: 25%)
        let langScore = strengths.international; // default
        if (isRo) {
            langScore = strengths.romanian;
        }
        else if (isEu) {
            langScore = strengths.european;
        }
        // 2. Task type score (weight: 25%)
        let taskScore = 1.0;
        if (taskType !== "unknown") {
            taskScore = strengths[taskType] ?? 1.0;
        }
        // 3. Health/performance score (weight: 15%)
        let healthScore = 1.0;
        if (health) {
            if (!health.healthy) {
                healthScore = 0.1; // Severely penalize unhealthy providers
            }
            else {
                // Factor in success rate and latency
                healthScore = health.successRate;
                // Bonus for low latency (normalize: <500ms = 1.5, >3000ms = 0.7)
                if (health.totalCalls > 0) {
                    const latencyFactor = Math.max(0.7, Math.min(1.5, 1.5 - (health.avgLatencyMs / 3000)));
                    healthScore *= latencyFactor;
                }
            }
        }
        // 4. Cost score (weight: 10%)
        const costScore = TIER_SCORE[config.tier] || 1.0;
        // 5. Speed vs quality preference (weight: 10%)
        const speedQualityScore = strengths.speed * speedPref + strengths.quality * (1 - speedPref);
        // 6. Resource headroom bonus (weight: 15%)
        //    Providers with more free space get a boost.
        //    Scale: 0% used = 1.5 (full headroom), 100% used = 0.0 (depleted)
        let resourceBonus = 1.0; // neutral if no data
        const rs = resourceStatus[id];
        if (rs) {
            const headroom = 1.0 - rs.usagePercent; // 1.0 = fully free, 0.0 = fully used
            resourceBonus = headroom * 1.5; // max bonus: 1.5, min: 0.0
        }
        // Weighted total (weights sum to 1.0)
        const totalScore = langScore * 0.25 +
            taskScore * 0.25 +
            healthScore * 0.15 +
            costScore * 0.10 +
            speedQualityScore * 0.10 +
            resourceBonus * 0.15;
        return {
            id,
            totalScore,
            breakdown: {
                language: langScore,
                task: taskScore,
                health: healthScore,
                cost: costScore,
                speed: speedQualityScore,
                resourceBonus,
            },
        };
    });
    // Sort by score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);
    return scores;
}
/** Get the best provider for a request, plus ordered fallback list */
function smartSelectProvider(availableProviders, context, healthMap) {
    const scores = scoreProviders(availableProviders, context, healthMap);
    if (scores.length === 0) {
        throw new Error("[ai-router/smart] No available providers");
    }
    const primary = scores[0].id;
    const fallbacks = scores.slice(1).map((s) => s.id);
    console.log(`[ai-router/smart] Selected: ${primary} (${scores[0].totalScore.toFixed(2)}) | ` +
        `Fallbacks: ${fallbacks.slice(0, 3).join(", ")} | ` +
        `Lang: ${isRomanianText(context.messages.map(m => m.content).join(" ")) ? "RO" : isEuropeanContext(context.messages.map(m => m.content).join(" ")) ? "EU" : "INT"} | ` +
        `Task: ${context.taskHint || detectTaskType(context.messages)}`);
    return { primary, fallbacks, scores };
}
//# sourceMappingURL=smart-router.js.map