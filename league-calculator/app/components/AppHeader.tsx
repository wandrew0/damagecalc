"use client";

import React from "react";
import Navigation from "./Navigation";

interface AppHeaderProps {
    title: string;
    actions?: React.ReactNode;
    keepActionsWithTitle?: boolean;
}

export default function AppHeader({ title, actions, keepActionsWithTitle = false }: AppHeaderProps) {
    const showInlineActions = keepActionsWithTitle && Boolean(actions);

    return (
        <div className="headerContainer">
            <div className="headerTop">
                <div className="headerTitleRow">
                    <Navigation className="header-nav" />
                    {showInlineActions ? (
                        <div className="headerTitleWithActions">
                            <h1>{title}</h1>
                            <div className="headerActions headerActionsInline">{actions}</div>
                        </div>
                    ) : (
                        <h1>{title}</h1>
                    )}
                </div>
                {!showInlineActions && actions ? <div className="headerActions">{actions}</div> : null}
            </div>
        </div>
    );
}
