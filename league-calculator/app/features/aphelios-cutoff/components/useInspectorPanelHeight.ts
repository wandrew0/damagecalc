import { RefObject, useEffect, useState } from "react";

interface UseInspectorPanelHeightArgs {
    hasInspectorSelection: boolean;
    inspectorPanelRef: RefObject<HTMLElement | null>;
}

export default function useInspectorPanelHeight({
    hasInspectorSelection,
    inspectorPanelRef,
}: UseInspectorPanelHeightArgs): number {
    const [lastSelectedPanelHeight, setLastSelectedPanelHeight] = useState(0);

    useEffect(() => {
        if (!hasInspectorSelection || !inspectorPanelRef.current) {
            return;
        }
        const element = inspectorPanelRef.current;
        const updateHeight = () => {
            setLastSelectedPanelHeight(Math.ceil(element.getBoundingClientRect().height));
        };
        updateHeight();
        if (typeof ResizeObserver === "undefined") {
            return;
        }
        const resizeObserver = new ResizeObserver(() => {
            updateHeight();
        });
        resizeObserver.observe(element);
        return () => {
            resizeObserver.disconnect();
        };
    }, [hasInspectorSelection, inspectorPanelRef]);

    return lastSelectedPanelHeight;
}
