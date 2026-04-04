"use strict";
// ═══════════════════════════════════════════════════════
// AI Router — Main Entry Point
// ═══════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRouterMetrics = exports.smartSelectProvider = exports.scoreProviders = exports.PROJECT_PRESETS = exports.listPresets = exports.getProjectPreset = exports.executeProvider = exports.FREE_PROVIDERS = exports.ALL_PROVIDER_IDS = exports.getProviderConfig = exports.PROVIDER_REGISTRY = exports.DEFAULT_RATE_LIMITS = exports.AIRouter = void 0;
// Core
var router_1 = require("./router");
Object.defineProperty(exports, "AIRouter", { enumerable: true, get: function () { return router_1.AIRouter; } });
var types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_RATE_LIMITS", { enumerable: true, get: function () { return types_1.DEFAULT_RATE_LIMITS; } });
// Provider registry
var registry_1 = require("./providers/registry");
Object.defineProperty(exports, "PROVIDER_REGISTRY", { enumerable: true, get: function () { return registry_1.PROVIDER_REGISTRY; } });
Object.defineProperty(exports, "getProviderConfig", { enumerable: true, get: function () { return registry_1.getProviderConfig; } });
Object.defineProperty(exports, "ALL_PROVIDER_IDS", { enumerable: true, get: function () { return registry_1.ALL_PROVIDER_IDS; } });
Object.defineProperty(exports, "FREE_PROVIDERS", { enumerable: true, get: function () { return registry_1.FREE_PROVIDERS; } });
// Provider executor
var executor_1 = require("./providers/executor");
Object.defineProperty(exports, "executeProvider", { enumerable: true, get: function () { return executor_1.executeProvider; } });
// Config presets
var config_1 = require("./config");
Object.defineProperty(exports, "getProjectPreset", { enumerable: true, get: function () { return config_1.getProjectPreset; } });
Object.defineProperty(exports, "listPresets", { enumerable: true, get: function () { return config_1.listPresets; } });
Object.defineProperty(exports, "PROJECT_PRESETS", { enumerable: true, get: function () { return config_1.PROJECT_PRESETS; } });
// Smart routing
var smart_router_1 = require("./smart-router");
Object.defineProperty(exports, "scoreProviders", { enumerable: true, get: function () { return smart_router_1.scoreProviders; } });
Object.defineProperty(exports, "smartSelectProvider", { enumerable: true, get: function () { return smart_router_1.smartSelectProvider; } });
// Runtime metrics (static method access)
var router_2 = require("./router");
Object.defineProperty(exports, "AIRouterMetrics", { enumerable: true, get: function () { return router_2.AIRouter; } });
//# sourceMappingURL=index.js.map