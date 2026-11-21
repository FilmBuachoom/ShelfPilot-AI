"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

export function Dialog({ title, variant = "modal", onDismiss, children }: {
  title: string;
  variant?: "modal" | "sheet";
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-dialog-focus]")?.focus();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId}
      className={variant === "sheet" ? "sp-sheet sp-dialog sp-dialog--sheet" : "sp-modal sp-dialog"}
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
      {variant === "sheet" && <div className="sp-sheet__grip" aria-hidden="true" />}
      <h2 id={titleId} className={variant === "sheet" ? "sp-sheet__title" : "sp-modal__title"}>{title}</h2>
      {children}
    </dialog>
  );
}
