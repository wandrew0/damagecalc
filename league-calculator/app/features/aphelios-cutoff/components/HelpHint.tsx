import React, { useId } from "react";

interface HelpHintProps {
    label: string;
    description: string;
}

export default function HelpHint({ label, description }: HelpHintProps): React.ReactNode {
    const tooltip = `${label}: ${description}`;
    const tooltipId = useId();
    return (
        <span className="help-hint-wrap">
            <button
                type="button"
                className="help-hint"
                aria-label={tooltip}
                aria-describedby={tooltipId}
            >
                ?
            </button>
            <span className="help-hint-tooltip" role="tooltip" id={tooltipId}>
                {tooltip}
            </span>
        </span>
    );
}
