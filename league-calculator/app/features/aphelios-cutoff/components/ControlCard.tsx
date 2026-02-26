import React from "react";

interface ControlCardProps {
    title: string;
    sectionId: string;
    isCompactLayout: boolean;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    compactSummary?: React.ReactNode;
}

export default function ControlCard({
    title,
    sectionId,
    isCompactLayout,
    isOpen,
    onToggle,
    children,
    compactSummary,
}: ControlCardProps): React.ReactNode {
    const panelId = `cutoff-control-panel-${sectionId}`;

    return (
        <section className={`cutoff-card ${isCompactLayout ? "cutoff-card-collapsible" : ""}`}>
            {isCompactLayout ? (
                <button
                    type="button"
                    className="cutoff-card-toggle"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={onToggle}
                >
                    <span className="cutoff-card-toggle-copy">
                        <span className="cutoff-card-toggle-title">{title}</span>
                        {!isOpen && compactSummary ? (
                            <span className="cutoff-card-toggle-summary">{compactSummary}</span>
                        ) : null}
                    </span>
                    <span className="cutoff-card-toggle-icon" aria-hidden="true">
                        {isOpen ? "−" : "+"}
                    </span>
                </button>
            ) : (
                <h3>{title}</h3>
            )}
            {isOpen ? (
                <div className="cutoff-card-body" id={panelId}>
                    {children}
                </div>
            ) : null}
        </section>
    );
}
