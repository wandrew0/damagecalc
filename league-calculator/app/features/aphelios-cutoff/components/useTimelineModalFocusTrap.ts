import { RefObject, useEffect } from "react";

interface UseTimelineModalFocusTrapArgs {
    isOpen: boolean;
    modalRef: RefObject<HTMLElement | null>;
    closeButtonRef: RefObject<HTMLButtonElement | null>;
    onRequestClose: () => void;
}

export default function useTimelineModalFocusTrap({
    isOpen,
    modalRef,
    closeButtonRef,
    onRequestClose,
}: UseTimelineModalFocusTrapArgs): void {
    useEffect(() => {
        if (!isOpen || !modalRef.current) return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousBodyPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarWidth > 0) {
            const computedPaddingRight =
                Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
            document.body.style.paddingRight = `${computedPaddingRight + scrollbarWidth}px`;
        }
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (!modalRef.current) return;

            if (event.key === "Escape") {
                event.preventDefault();
                onRequestClose();
                return;
            }

            if (event.key !== "Tab") return;

            const focusableElements = Array.from(
                modalRef.current.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                )
            ).filter(
                (node) =>
                    node.tabIndex !== -1 &&
                    node.getAttribute("aria-hidden") !== "true" &&
                    node.offsetParent !== null
            );

            if (focusableElements.length === 0) {
                event.preventDefault();
                modalRef.current.focus();
                return;
            }

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];
            const activeElement = document.activeElement as HTMLElement | null;

            if (!event.shiftKey && activeElement === last) {
                event.preventDefault();
                first.focus();
                return;
            }

            if (event.shiftKey && activeElement === first) {
                event.preventDefault();
                last.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousBodyOverflow;
            document.body.style.paddingRight = previousBodyPaddingRight;
        };
    }, [isOpen, modalRef, closeButtonRef, onRequestClose]);
}
