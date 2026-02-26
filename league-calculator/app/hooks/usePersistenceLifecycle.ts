import { useEffect, useState } from "react";

interface UsePersistenceLifecycleArgs {
    loadState: () => void | (() => void);
    saveState: () => void;
}

export default function usePersistenceLifecycle({
    loadState,
    saveState,
}: UsePersistenceLifecycleArgs): boolean {
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const cleanup = loadState();
        setIsLoaded(true);
        return cleanup;
    }, [loadState]);

    useEffect(() => {
        if (!isLoaded) return;
        saveState();
    }, [isLoaded, saveState]);

    return isLoaded;
}
