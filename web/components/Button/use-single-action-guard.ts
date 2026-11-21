"use client";

import { useEffect } from "react";

export function useSingleActionGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let warned = false;
    const check = () => {
      if (warned) return;
      const actions = [...document.querySelectorAll(".sp-btn--action")]
        .filter((button) => button.getClientRects().length > 0);
      if (actions.length > 1) {
        console.warn("ShelfPilot: use at most one action button per screen.");
        warned = true;
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "open"],
    });
    window.addEventListener("resize", check);
    check();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", check);
    };
  }, []);
}
