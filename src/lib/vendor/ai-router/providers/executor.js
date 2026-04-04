"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Provider Executor (HTTP calls to each API)
// ═══════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeProvider = executeProvider;
/** Execute a request against a specific provider */
async function executeProvider(opts) {
    const { config } = opts;
    const apiKey = process.env[config.apiKeyEnvVar];
    if (!apiKey) {
        throw new Error(`Missing API key: ${config.apiKeyEnvVar}`);
    }
    const model = opts.model || config.defaultModel;
    const maxTokens = opts.maxTokens || config.maxTokens;
    const temperature = opts.temperature ?? config.temperature;
    const start = Date.now();
    switch (config.id) {
        case "gemini":
            return executeGemini({ ...opts, model, maxTokens, temperature }, apiKey, start);
        case "claude":
            return executeClaude({ ...opts, model, maxTokens, temperature }, apiKey, start);
        case "cohere":
            return executeCohere({ ...opts, model, maxTokens, temperature }, apiKey, start);
        default:
            // OpenAI-compatible: groq, openai, mistral, together, fireworks
            return executeOpenAICompat({ ...opts, model, maxTokens, temperature }, apiKey, start);
    }
}
// ── OpenAI-compatible (Groq, OpenAI, Mistral, Together, Fireworks) ──
async function executeOpenAICompat(opts, apiKey, start) {
    const { config, messages, model, maxTokens, temperature, jsonMode } = opts;
    const body = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
    };
    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }
    const res = await fetch(config.baseUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(config.headers || {}),
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`[${config.id}] ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = (await res.json());
    const content = data.choices?.[0]?.message?.content || "";
    const usage = data.usage;
    return {
        content,
        provider: config.id,
        model,
        tokenUsage: usage
            ? { input: usage.prompt_tokens, output: usage.completion_tokens, total: usage.total_tokens }
            : undefined,
        latencyMs: Date.now() - start,
        fallback: false,
    };
}
// ── Google Gemini ──
async function executeGemini(opts, apiKey, start) {
    const { messages, model, maxTokens, temperature } = opts;
    // Convert messages to Gemini format
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");
    const geminiContents = nonSystemMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }));
    const body = {
        contents: geminiContents,
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
        },
    };
    if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`[gemini] ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = (await res.json());
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const usage = data.usageMetadata;
    return {
        content,
        provider: "gemini",
        model,
        tokenUsage: usage
            ? { input: usage.promptTokenCount, output: usage.candidatesTokenCount, total: usage.totalTokenCount }
            : undefined,
        latencyMs: Date.now() - start,
        fallback: false,
    };
}
// ── Anthropic Claude ──
async function executeClaude(opts, apiKey, start) {
    const { messages, model, maxTokens, temperature } = opts;
    const systemMsg = messages.find((m) => m.role === "system");
    const nonSystemMsgs = messages.filter((m) => m.role !== "system");
    const body = {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
    };
    if (systemMsg) {
        body.system = systemMsg.content;
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`[claude] ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = (await res.json());
    const content = data.content?.[0]?.text || "";
    const usage = data.usage;
    return {
        content,
        provider: "claude",
        model,
        tokenUsage: usage
            ? { input: usage.input_tokens, output: usage.output_tokens, total: (usage.input_tokens || 0) + (usage.output_tokens || 0) }
            : undefined,
        latencyMs: Date.now() - start,
        fallback: false,
    };
}
// ── Cohere ──
async function executeCohere(opts, apiKey, start) {
    const { messages, model, maxTokens, temperature } = opts;
    // Cohere v2 chat API format
    const body = {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
    };
    const res = await fetch("https://api.cohere.com/v2/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "Unknown error");
        throw new Error(`[cohere] ${res.status}: ${errText.substring(0, 200)}`);
    }
    const data = (await res.json());
    const content = data.message?.content?.[0]?.text || "";
    const usage = data.usage?.tokens;
    return {
        content,
        provider: "cohere",
        model,
        tokenUsage: usage
            ? { input: usage.input_tokens, output: usage.output_tokens, total: (usage.input_tokens || 0) + (usage.output_tokens || 0) }
            : undefined,
        latencyMs: Date.now() - start,
        fallback: false,
    };
}
//# sourceMappingURL=executor.js.map