"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIProviderSelect = AIProviderSelect;
const jsx_runtime_1 = require("react/jsx-runtime");
const registry_1 = require("../providers/registry");
function AIProviderSelect({ value, onChange, providers, availableOnly = false, availableProviders, className = "h-9 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm", showTier = true, disabled = false, label, }) {
    const allProviders = providers || Object.keys(registry_1.PROVIDER_REGISTRY);
    const visibleProviders = availableOnly && availableProviders
        ? allProviders.filter((id) => availableProviders.includes(id))
        : allProviders;
    const getLabel = (id) => {
        const config = registry_1.PROVIDER_REGISTRY[id];
        if (!config)
            return id;
        if (!showTier)
            return config.name;
        return config.label;
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [label && ((0, jsx_runtime_1.jsx)("label", { className: "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1", children: label })), (0, jsx_runtime_1.jsxs)("select", { value: value, onChange: (e) => onChange(e.target.value), className: className, disabled: disabled, children: [(0, jsx_runtime_1.jsx)("option", { value: "auto", children: "Auto (Round-robin)" }), visibleProviders.map((id) => ((0, jsx_runtime_1.jsx)("option", { value: id, children: getLabel(id) }, id)))] })] }));
}
//# sourceMappingURL=AIProviderSelect.js.map