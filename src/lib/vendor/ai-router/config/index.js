"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Project-specific Preset Configs
// ═══════════════════════════════════════════════════════
//
// Provider order: FREE first (fallback priority), then PAID last.
// Groq is now PAID — moved to end with other paid providers.
// Default for all projects: "auto" (round-robin on free providers).
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_PRESETS = void 0;
exports.getProjectPreset = getProjectPreset;
exports.listPresets = listPresets;
// Canonical order: free → freemium → paid
const FREE_FIRST = ["gemini", "mistral", "cohere", "together", "fireworks", "groq", "openai", "claude"];
/**
 * Recommended defaults per project.
 * Each project can override: default provider, provider list, model overrides.
 */
exports.PROJECT_PRESETS = {
    // Source: Claude understands Romanian suppliers best
    source: {
        projectName: "Source",
        defaultProvider: "claude",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "claude", "openai", "groq"],
    },
    // TradeInvest: Gemini as default (Groq no longer free), free providers first
    tradeinvest: {
        projectName: "TradeInvest",
        defaultProvider: "mistral",
        providers: ["cerebras", "sambanova", "mistral", "perplexity", "gemini", "cohere", "hyperbolic", "openrouter", "together", "fireworks", "deepinfra", "novita", "lepton", "groq", "openai", "claude-cli", "claude"],
    },
    // BlocHub: Gemini for general content
    blochub: {
        projectName: "BlocHub",
        defaultProvider: "gemini",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // UtilajHub: Mistral (EU GDPR) for Romanian marketplace
    utilajhub: {
        projectName: "UtilajHub",
        defaultProvider: "mistral",
        providers: ["mistral", "gemini", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // eCabinet: Gemini for document processing
    ecabinet: {
        projectName: "eCabinet",
        defaultProvider: "gemini",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // AVE: General purpose, auto round-robin on free providers
    ave: {
        projectName: "AVE",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // 4uPDF: Cohere for text extraction/summarization
    "4updf": {
        projectName: "4uPDF",
        defaultProvider: "cohere",
        providers: ["cohere", "gemini", "mistral", "together", "fireworks", "openai", "claude", "groq"],
    },
    // TeInformez: Romanian news platform — Mistral (EU/GDPR) preferred, free providers first
    teinformez: {
        projectName: "TeInformez",
        defaultProvider: "auto",
        providers: ["cerebras", "sambanova", "gemini", "mistral", "cohere", "openrouter", "perplexity", "together", "fireworks", "novita", "lepton", "groq", "openai", "claude-cli", "claude", "deepinfra", "hyperbolic"],
    },
    // utilajhubnext (auto-added from Master dashboard)
    utilajhubnext: {
        projectName: "utilajhubnext",
        defaultProvider: "auto",
        providers: ["cerebras", "gemini", "mistral", "cohere", "sambanova", "openrouter", "together", "fireworks", "groq", "openai", "claude-cli", "claude", "perplexity", "deepinfra", "novita", "lepton", "hyperbolic"],
    },
    // 4pro-client: general purpose, auto round-robin
    "4proclient": {
        projectName: "4pro-client",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // 4pro-identity: identity/auth service
    "4proidentity": {
        projectName: "4pro-identity",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // 4pro-landing: landing pages
    "4prolanding": {
        projectName: "4pro-landing",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // 4pro-biz: Romanian business crawling & categorization
    "4probiz": {
        projectName: "4pro-biz",
        defaultProvider: "auto",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // Tester: AI-powered testing (needs vision-capable providers)
    tester: {
        projectName: "Tester",
        defaultProvider: "claude",
        providers: ["claude", "gemini", "openai", "mistral", "cohere", "together", "fireworks", "groq"],
    },
    // MarketingAutomation: content generation
    marketingautomation: {
        projectName: "MarketingAutomation",
        defaultProvider: "auto",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // SEAP: Romanian public procurement analysis
    seap: {
        projectName: "SEAP",
        defaultProvider: "auto",
        providers: ["mistral", "gemini", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // Feedback-Hub: feedback analysis
    feedbackhub: {
        projectName: "Feedback-Hub",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // Scrap-module: web scraping with AI extraction
    scrapmodule: {
        projectName: "Scrap-module",
        defaultProvider: "auto",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // E-mail Guru: email classification
    emailguru: {
        projectName: "E-mail Guru",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // ocr-model: OCR validation
    ocrmodel: {
        projectName: "ocr-model",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // STT: speech-to-text (Whisper uses OpenAI directly, router for future chat)
    stt: {
        projectName: "STT",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // Meeting-rec: meeting recording (Whisper direct, router for future chat)
    meetingrec: {
        projectName: "Meeting-rec",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // OpenAI: coding agent (prefers OpenAI for model compatibility)
    openai: {
        projectName: "OpenAI",
        defaultProvider: "openai",
        providers: ["openai", "gemini", "mistral", "cohere", "together", "fireworks", "claude", "groq"],
    },
    // eProfit: Romanian accounting/tax — Gemini for OCR, Mistral for EU compliance
    eprofit: {
        projectName: "eProfit",
        defaultProvider: "gemini",
        providers: ["gemini", "mistral", "cohere", "together", "fireworks", "openai", "claude", "groq"],
    },
    // HeadHunter: recruitment/HR
    headhunter: {
        projectName: "HeadHunter",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
    // GCalendar, GMaps, KB, Stripe, Telegram, whatsapp — general purpose
    gcalendar: { projectName: "GCalendar", defaultProvider: "auto", providers: FREE_FIRST },
    gmaps: { projectName: "GMaps", defaultProvider: "auto", providers: FREE_FIRST },
    kb: { projectName: "KB", defaultProvider: "auto", providers: FREE_FIRST },
    stripe: { projectName: "Stripe", defaultProvider: "auto", providers: FREE_FIRST },
    telegram: { projectName: "Telegram", defaultProvider: "auto", providers: FREE_FIRST },
    whatsapp: { projectName: "whatsapp", defaultProvider: "auto", providers: FREE_FIRST },
    websiteguru: { projectName: "website-guru", defaultProvider: "auto", providers: FREE_FIRST },
    promptarchitect: { projectName: "Prompt-Architect", defaultProvider: "auto", providers: FREE_FIRST },
    myholiday: { projectName: "Myholiday", defaultProvider: "auto", providers: FREE_FIRST },
    devlearningplatform: { projectName: "DevLearningPlatform", defaultProvider: "auto", providers: FREE_FIRST },
    // Default: balanced round-robin (free providers first, paid last)
    default: {
        projectName: "Default",
        defaultProvider: "auto",
        providers: FREE_FIRST,
    },
};
/** Get project config by name (case-insensitive), falls back to default */
function getProjectPreset(projectName) {
    const key = projectName.toLowerCase().replace(/[-_\s]/g, "");
    return exports.PROJECT_PRESETS[key] || { ...exports.PROJECT_PRESETS.default, projectName };
}
/** List all available presets */
function listPresets() {
    return Object.keys(exports.PROJECT_PRESETS);
}
//# sourceMappingURL=index.js.map