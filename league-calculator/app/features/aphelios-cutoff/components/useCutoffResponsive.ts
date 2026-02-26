import { useEffect, useState } from "react";
import useTouchDevice from "../../../hooks/useTouchDevice";

interface UseCutoffResponsiveArgs {
    compactLayoutQuery: string;
    onCompactLayoutEnabled?: () => void;
}

interface UseCutoffResponsiveResult {
    isTouchDevice: boolean;
    modalSelectPortalTarget: HTMLElement | null;
    isCompactLayout: boolean;
}

export default function useCutoffResponsive({
    compactLayoutQuery,
    onCompactLayoutEnabled,
}: UseCutoffResponsiveArgs): UseCutoffResponsiveResult {
    const isTouchDevice = useTouchDevice();
    const [modalSelectPortalTarget, setModalSelectPortalTarget] =
        useState<HTMLElement | null>(null);
    const [isCompactLayout, setIsCompactLayout] = useState(false);

    useEffect(() => {
        if (typeof document === "undefined") return;
        setModalSelectPortalTarget(isTouchDevice ? null : document.body);
    }, [isTouchDevice]);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }
        const mediaQuery = window.matchMedia(compactLayoutQuery);
        const onChange = (event: MediaQueryListEvent) => {
            setIsCompactLayout(event.matches);
        };
        setIsCompactLayout(mediaQuery.matches);
        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", onChange);
            return () => mediaQuery.removeEventListener("change", onChange);
        }
        mediaQuery.addListener(onChange);
        return () => mediaQuery.removeListener(onChange);
    }, [compactLayoutQuery]);

    useEffect(() => {
        if (!isCompactLayout || !onCompactLayoutEnabled) return;
        onCompactLayoutEnabled();
    }, [isCompactLayout, onCompactLayoutEnabled]);

    return {
        isTouchDevice,
        modalSelectPortalTarget,
        isCompactLayout,
    };
}
