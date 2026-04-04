import type { AIProviderID, AIProviderSelection } from "../types";
export interface AIProviderSelectProps {
    /** Current selected value */
    value: AIProviderSelection;
    /** Called when selection changes */
    onChange: (value: AIProviderSelection) => void;
    /** Which providers to show (default: all) */
    providers?: AIProviderID[];
    /** Show only providers that have API keys configured */
    availableOnly?: boolean;
    /** Available provider IDs (from server check) */
    availableProviders?: AIProviderID[];
    /** CSS class for the select element */
    className?: string;
    /** Show tier labels like (Free), (Paid) */
    showTier?: boolean;
    /** Disabled state */
    disabled?: boolean;
    /** Label text above the select */
    label?: string;
}
export declare function AIProviderSelect({ value, onChange, providers, availableOnly, availableProviders, className, showTier, disabled, label, }: AIProviderSelectProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AIProviderSelect.d.ts.map