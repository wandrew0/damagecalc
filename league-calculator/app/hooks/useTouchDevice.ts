import { useEffect, useState } from "react";

export default function useTouchDevice(): boolean {
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
        const touchCapable = coarsePointer || navigator.maxTouchPoints > 0;
        setIsTouchDevice(touchCapable);
    }, []);

    return isTouchDevice;
}
